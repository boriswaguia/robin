import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/** Ensure uploads directory exists */
export function ensureDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function getAllMail(userId) {
  return prisma.mail.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/** Get distinct contacts (senders + receivers) with mail counts */
export async function getContacts(userId) {
  const mail = await prisma.mail.findMany({
    where: { userId, status: { not: 'processing' } },
    select: { sender: true, receiver: true, category: true, createdAt: true },
  });

  const contacts = new Map();

  for (const m of mail) {
    if (m.sender && m.sender !== 'Unknown') {
      const key = m.sender.toLowerCase();
      if (!contacts.has(key)) {
        contacts.set(key, { name: m.sender, type: 'sender', count: 0, categories: new Set(), lastDate: m.createdAt });
      }
      const c = contacts.get(key);
      c.count++;
      if (m.category) c.categories.add(m.category);
      if (m.createdAt > c.lastDate) c.lastDate = m.createdAt;
    }

    if (m.receiver && m.receiver !== 'Unknown') {
      const key = m.receiver.toLowerCase();
      if (!contacts.has(key)) {
        contacts.set(key, { name: m.receiver, type: 'receiver', count: 0, categories: new Set(), lastDate: m.createdAt });
      }
      const c = contacts.get(key);
      c.count++;
      if (m.category) c.categories.add(m.category);
      if (m.createdAt > c.lastDate) c.lastDate = m.createdAt;
    }
  }

  return [...contacts.values()]
    .map((c) => ({ ...c, categories: [...c.categories] }))
    .sort((a, b) => b.count - a.count);
}

/** Get all mail for a specific contact (as sender OR receiver) */
export async function getMailByContact(userId, contactName) {
  // Fetch all mail and filter in JS — sender/receiver are encrypted at rest
  // so SQL-level equality checks would compare plaintext against ciphertext.
  const allMail = await prisma.mail.findMany({
    where: { userId, status: { not: 'processing' } },
    orderBy: { createdAt: 'desc' },
  });
  const lower = contactName.toLowerCase();
  return allMail.filter(m =>
    (m.sender && m.sender.toLowerCase() === lower) ||
    (m.receiver && m.receiver.toLowerCase() === lower)
  );
}

export async function getMailById(id, userId) {
  return prisma.mail.findFirst({
    where: { id, userId },
    include: {
      installments: {
        orderBy: { dueDate: 'asc' },
        select: { id: true, dueDate: true, amountDue: true, status: true, actionTaken: true, installmentLabel: true },
      },
      parent: {
        select: { id: true, summary: true, imageUrl: true, imageUrls: true, installmentLabel: true },
      },
    },
  });
}

export async function saveMail(data) {
  return prisma.mail.create({ data });
}

export async function updateMail(id, userId, data) {
  const existing = await prisma.mail.findFirst({ where: { id, userId } });
  if (!existing) return null;

  return prisma.mail.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function deleteMail(id, userId) {
  const existing = await prisma.mail.findFirst({ where: { id, userId } });
  if (!existing) return null;

  return prisma.mail.delete({ where: { id } });
}

/** Get all mail items in the same thread */
export async function getRelatedMail(threadId, excludeId, userId) {
  if (!threadId) return [];
  return prisma.mail.findMany({
    where: { threadId, userId, id: { not: excludeId } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sender: true,
      summary: true,
      category: true,
      urgency: true,
      status: true,
      actionTaken: true,
      dueDate: true,
      amountDue: true,
      createdAt: true,
    },
  });
}

/** Get agenda items: mail with a dueDate, grouped by overdue / this-week / upcoming */
export async function getAgendaItems(userId) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Fetch mail with a dueDate that still needs action
  const items = await prisma.mail.findMany({
    where: {
      userId,
      dueDate: { not: null },
      status: 'new', // only items that haven't been actioned yet
    },
    orderBy: { dueDate: 'asc' },
  });

  const overdue = [];
  const thisWeek = [];
  const upcoming = [];

  for (const item of items) {
    const due = new Date(item.dueDate);
    if (isNaN(due.getTime())) continue; // skip invalid dates
    if (due < today) {
      overdue.push(item);
    } else if (due < weekEnd) {
      thisWeek.push(item);
    } else {
      upcoming.push(item);
    }
  }

  // Sort each bucket by parsed date ascending (handles any string format)
  const byDate = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);
  overdue.sort(byDate);
  thisWeek.sort(byDate);
  upcoming.sort(byDate);

  return { overdue, thisWeek, upcoming };
}

/** Get reminders that are due for a specific user */
export async function getDueReminders(userId) {
  return prisma.mail.findMany({
    where: {
      userId,
      reminderAt: { lte: new Date() },
      reminderSent: false,
    },
    orderBy: { reminderAt: 'asc' },
  });
}

/** Mark a reminder as sent */
export async function markReminderSent(id) {
  return prisma.mail.update({
    where: { id },
    data: { reminderSent: true },
  });
}
