/**
 * Robin Notification Scheduler
 *
 * Uses node-cron for reliable scheduling. Two jobs:
 *
 *  1. Reminder check  — cron "every 5 minutes"
 *     Fires push notifications for items whose reminderAt is now due.
 *     Restart-safe by nature: the next cron tick catches any missed reminders.
 *     → 288 DB queries/day
 *
 *  2. Overdue check   — cron "09:00 every day"
 *     Finds items where dueDate has passed with no action taken.
 *     Restart-safe via SchedulerState table: on startup we check if the
 *     09:00 window was missed today and run immediately if so.
 *     → 1 DB query/day (+ 1 on startup if a run was missed)
 *
 * Single-instance only. For multi-instance deployments, replace with
 * pg-boss (PostgreSQL-backed queue with distributed locking).
 */
import cron from 'node-cron';
import prisma from './db.js';
import { sendPushToUser, isPushConfigured } from './push.js';

const OVERDUE_JOB  = 'overdue-notifications';
const OVERDUE_HOUR = 9; // 09:00 server local time

export function startScheduler() {
  console.log('Notification scheduler started (reminders: every 5 min | overdue: daily 09:00)');

  // ── Job 1: Reminders — every 5 minutes ────────────────────────────────────
  cron.schedule('*/5 * * * *', () => {
    fireReminderNotifications().catch((err) =>
      console.error('Reminder job error:', err.message));
  });

  // Run once immediately on startup to catch any reminders due during downtime
  fireReminderNotifications().catch((err) =>
    console.error('Reminder startup check error:', err.message));

  // ── Job 2: Overdue — daily at 09:00 ───────────────────────────────────────
  cron.schedule(`0 ${OVERDUE_HOUR} * * *`, () => {
    runOverdueAndRecord().catch((err) =>
      console.error('Overdue job error:', err.message));
  });

  // Startup recovery: if the server restarted after 09:00 today and the job
  // hasn't run yet, run it now so no overdue notifications are missed.
  recoverOverdueIfMissed().catch((err) =>
    console.error('Overdue recovery check error:', err.message));
}

// ── Restart recovery ──────────────────────────────────────────────────────────

async function recoverOverdueIfMissed() {
  const now = new Date();
  // Only recover if we're past today's scheduled hour
  if (now.getHours() < OVERDUE_HOUR) return;

  const todayRunStart = new Date(now);
  todayRunStart.setHours(OVERDUE_HOUR, 0, 0, 0);

  const state = await prisma.schedulerState.findUnique({
    where: { jobName: OVERDUE_JOB },
  });

  const lastRun = state?.lastRunAt;
  if (!lastRun || lastRun < todayRunStart) {
    console.log('Overdue job missed (server was down) — running now');
    await runOverdueAndRecord();
  }
}

async function runOverdueAndRecord() {
  await fireOverdueNotifications();
  // Upsert the last-run timestamp regardless of whether there were notifications
  await prisma.schedulerState.upsert({
    where:  { jobName: OVERDUE_JOB },
    update: { lastRunAt: new Date() },
    create: { jobName: OVERDUE_JOB, lastRunAt: new Date() },
  });
}

// ── Job 1: Due reminders ──────────────────────────────────────────────────────

async function fireReminderNotifications() {
  if (!isPushConfigured()) return;

  const now = new Date();
  const dueMail = await prisma.mail.findMany({
    where: {
      reminderAt: { lte: now },
      reminderSent: false,
      status: 'new',
    },
    select: { id: true, userId: true, summary: true, dueDate: true, urgency: true },
  });

  for (const item of dueMail) {
    try {
      const dueDateLabel = item.dueDate ? ` — due ${item.dueDate}` : '';
      await sendPushToUser(item.userId, {
        title: '⏰ Reminder: Action needed',
        body: (item.summary || 'A letter needs your attention') + dueDateLabel,
        tag: `reminder-${item.id}`,
        url: `/mail/${item.id}`,
        requireInteraction: item.urgency === 'high',
      });
      await prisma.mail.update({ where: { id: item.id }, data: { reminderSent: true } });
    } catch (err) {
      console.error(`Reminder push failed for mail ${item.id}:`, err.message);
    }
  }

  if (dueMail.length) console.log(`Sent ${dueMail.length} reminder notification(s)`);
}

// ── Job 2: Overdue items ──────────────────────────────────────────────────────

async function fireOverdueNotifications() {
  if (!isPushConfigured()) return;

  const todayIso = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

  const overdueMail = await prisma.mail.findMany({
    where: {
      status: 'new',
      overdueReminderSent: false,
      AND: [
        { dueDate: { not: null } },
        { dueDate: { lt: todayIso } },
      ],
    },
    select: { id: true, userId: true, summary: true, dueDate: true },
  });

  for (const item of overdueMail) {
    try {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(item.dueDate).getTime()) / 86400000,
      );
      const dayLabel = daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`;

      await sendPushToUser(item.userId, {
        title: '🚨 Overdue — action still needed',
        body: `${item.summary || 'A letter needs your attention'} (${dayLabel})`,
        tag: `overdue-${item.id}`,
        url: `/mail/${item.id}`,
        requireInteraction: true,
      });
      await prisma.mail.update({ where: { id: item.id }, data: { overdueReminderSent: true } });
    } catch (err) {
      console.error(`Overdue push failed for mail ${item.id}:`, err.message);
    }
  }

  if (overdueMail.length) console.log(`Sent ${overdueMail.length} overdue notification(s)`);
}
