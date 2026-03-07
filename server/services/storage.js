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

/** Search mail with filters */
export async function searchMail(userId, { q, sender, receiver, category, status, dateFrom, dateTo }) {
  const where = { userId };

  if (q) {
    where.OR = [
      { sender: { contains: q, mode: 'insensitive' } },
      { receiver: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { extractedText: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (sender) where.sender = { contains: sender, mode: 'insensitive' };
  if (receiver) where.receiver = { contains: receiver, mode: 'insensitive' };
  if (category) where.category = category;
  if (status === 'action_needed') where.status = 'new';
  else if (status === 'done') where.status = 'action_taken';
  else if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  return prisma.mail.findMany({
    where,
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
  return prisma.mail.findMany({
    where: {
      userId,
      status: { not: 'processing' },
      OR: [
        { sender: { equals: contactName, mode: 'insensitive' } },
        { receiver: { equals: contactName, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMailById(id, userId) {
  return prisma.mail.findFirst({
    where: { id, userId },
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
