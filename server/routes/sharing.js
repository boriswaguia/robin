import express from 'express';
import prisma from '../services/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return mail shared with userId from all accepted incoming connections */
async function _getSharedWithMe(userId) {
  const connections = await prisma.shareConnection.findMany({
    where: { toUserId: userId, status: 'accepted' },
    include: { fromUser: { select: { id: true, name: true, email: true } } },
  });
  if (!connections.length) return [];

  const results = [];
  const seenIds = new Set();

  for (const conn of connections) {
    const sharedBy = { id: conn.fromUser.id, name: conn.fromUser.name, email: conn.fromUser.email };

    // 1. Explicit per-item shares
    const explicitShares = await prisma.mailShare.findMany({
      where: { sharedWithUserId: userId, sharedByUserId: conn.fromUserId },
      include: { mail: true },
    });
    for (const s of explicitShares) {
      if (!seenIds.has(s.mailId) && s.mail.status !== 'processing') {
        results.push({ ...s.mail, sharedBy, sharedExplicitly: true });
        seenIds.add(s.mailId);
      }
    }

    // 2. Auto-share by category rule
    const cats = conn.sharedCategories;
    if (Array.isArray(cats) && cats.length > 0) {
      const categoryMail = await prisma.mail.findMany({
        where: {
          userId: conn.fromUserId,
          category: { in: cats },
          status: { not: 'processing' },
          source: 'scan', // never auto-share gmail items
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      for (const m of categoryMail) {
        if (!seenIds.has(m.id)) {
          results.push({ ...m, sharedBy, sharedExplicitly: false });
          seenIds.add(m.id);
        }
      }
    }
  }

  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── GET /api/sharing/shared-with-me ──────────────────────────────────────────

router.get('/shared-with-me', async (req, res) => {
  try {
    const items = await _getSharedWithMe(req.user.id);
    res.json(items);
  } catch (err) {
    console.error('shared-with-me error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── GET /api/sharing/connections ─────────────────────────────────────────────
// Returns accepted connections in both directions for this user

router.get('/connections', async (req, res) => {
  try {
    const [sent, received] = await Promise.all([
      prisma.shareConnection.findMany({
        where: { fromUserId: req.user.id },
        include: { toUser: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.shareConnection.findMany({
        where: { toUserId: req.user.id, status: 'accepted' },
        include: { fromUser: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ sent, received });
  } catch (err) {
    console.error('connections error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── GET /api/sharing/pending ─────────────────────────────────────────────────
// Pending invites sent TO this user

router.get('/pending', async (req, res) => {
  try {
    const invites = await prisma.shareConnection.findMany({
      where: { toUserId: req.user.id, status: 'pending' },
      include: { fromUser: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  } catch (err) {
    console.error('pending invites error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── POST /api/sharing/invite ──────────────────────────────────────────────────
// Send a sharing invite to another user by email

router.post('/invite', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const target = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true },
  });
  if (!target) return res.status(404).json({ error: 'No Robin account found with that email' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot invite yourself' });

  // Check if I already have a connection in this direction (me → them)
  const existing = await prisma.shareConnection.findUnique({
    where: { fromUserId_toUserId: { fromUserId: req.user.id, toUserId: target.id } },
  });
  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'You are already sharing with this user' });
    return res.status(409).json({ error: 'You already sent an invite to this user' });
  }

  // Check if THEY sent us an invite (them → me)
  const reverse = await prisma.shareConnection.findUnique({
    where: { fromUserId_toUserId: { fromUserId: target.id, toUserId: req.user.id } },
  });
  if (reverse && reverse.status === 'pending') {
    // Auto-accept their invite and create our forward connection (auto-accepted too)
    const [accepted, created] = await prisma.$transaction([
      prisma.shareConnection.update({
        where: { id: reverse.id },
        data: { status: 'accepted', updatedAt: new Date() },
        include: { fromUser: { select: { id: true, name: true, email: true } } },
      }),
      prisma.shareConnection.create({
        data: { fromUserId: req.user.id, toUserId: target.id, status: 'accepted' },
        include: { toUser: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    return res.status(200).json({ connection: created, reverse: accepted, autoAccepted: true });
  }

  // If they already have an accepted connection to us, auto-accept ours too
  const newStatus = (reverse && reverse.status === 'accepted') ? 'accepted' : 'pending';

  const connection = await prisma.shareConnection.create({
    data: { fromUserId: req.user.id, toUserId: target.id, status: newStatus },
    include: { toUser: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json({ connection, autoAccepted: newStatus === 'accepted' });
});

// ── PATCH /api/sharing/:id/accept ─────────────────────────────────────────────

router.patch('/:id/accept', async (req, res) => {
  try {
  const conn = await prisma.shareConnection.findUnique({ where: { id: req.params.id } });
  if (!conn) return res.status(404).json({ error: 'Invite not found' });
  if (conn.toUserId !== req.user.id) return res.status(403).json({ error: 'Not your invite' });
  if (conn.status !== 'pending') return res.status(400).json({ error: 'Invite is not pending' });

  const updated = await prisma.shareConnection.update({
    where: { id: req.params.id },
    data: { status: 'accepted', updatedAt: new Date() },
    include: { fromUser: { select: { id: true, name: true, email: true } } },
  });
  res.json(updated);
  } catch (err) {
    console.error('accept invite error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── DELETE /api/sharing/:id/reject ───────────────────────────────────────────

router.delete('/:id/reject', async (req, res) => {
  try {
  const conn = await prisma.shareConnection.findUnique({ where: { id: req.params.id } });
  if (!conn) return res.status(404).json({ error: 'Invite not found' });
  if (conn.toUserId !== req.user.id) return res.status(403).json({ error: 'Not your invite' });

  await prisma.shareConnection.delete({ where: { id: req.params.id } });
  res.json({ success: true });
  } catch (err) {
    console.error('reject invite error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── DELETE /api/sharing/:id ───────────────────────────────────────────────────
// Remove an accepted connection (either participant can do this)

router.delete('/:id', async (req, res) => {
  try {
  const conn = await prisma.shareConnection.findUnique({ where: { id: req.params.id } });
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  if (conn.fromUserId !== req.user.id && conn.toUserId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Clean up MailShare records for THIS direction only (from → to)
  // The reverse connection (if any) keeps its own shares intact
  await prisma.mailShare.deleteMany({
    where: { sharedByUserId: conn.fromUserId, sharedWithUserId: conn.toUserId },
  });

  await prisma.shareConnection.delete({ where: { id: req.params.id } });
  res.json({ success: true });
  } catch (err) {
    console.error('delete connection error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── PATCH /api/sharing/:id/categories ────────────────────────────────────────
// Update which categories are auto-shared for a connection (owner only — from side)

router.patch('/:id/categories', async (req, res) => {
  try {
  const conn = await prisma.shareConnection.findUnique({ where: { id: req.params.id } });
  if (!conn) return res.status(404).json({ error: 'Connection not found' });
  if (conn.fromUserId !== req.user.id) return res.status(403).json({ error: 'Only the inviter can set sharing rules' });
  if (conn.status !== 'accepted') return res.status(400).json({ error: 'Connection is not active' });

  const { categories } = req.body; // [] to clear, ['bill','medical'] to set
  if (!Array.isArray(categories)) return res.status(400).json({ error: 'categories must be an array' });

  const VALID_CATEGORIES = ['bill', 'government', 'legal', 'medical', 'insurance', 'financial', 'tax', 'personal', 'subscription', 'reminder', 'advertisement', 'delivery', 'other'];
  const invalid = categories.filter((c) => !VALID_CATEGORIES.includes(c));
  if (invalid.length > 0) return res.status(400).json({ error: `Invalid categories: ${invalid.join(', ')}` });

  const updated = await prisma.shareConnection.update({
    where: { id: req.params.id },
    data: { sharedCategories: categories.length > 0 ? categories : null, updatedAt: new Date() },
  });
  res.json(updated);
  } catch (err) {
    console.error('update categories error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── POST /api/sharing/mail/:mailId/share ──────────────────────────────────────
// Toggle per-item share with one or more connected users
// body: { sharedWithUserId, shared: true | false }

router.post('/mail/:mailId/share', async (req, res) => {
  try {
  const { sharedWithUserId, shared } = req.body;
  if (!sharedWithUserId || typeof shared !== 'boolean') {
    return res.status(400).json({ error: 'sharedWithUserId and shared (boolean) are required' });
  }

  // Verify mail ownership
  const mail = await prisma.mail.findFirst({ where: { id: req.params.mailId, userId: req.user.id } });
  if (!mail) return res.status(404).json({ error: 'Mail not found' });

  // Gmail items cannot be shared — Gmail stays personal
  if (mail.source === 'gmail') return res.status(400).json({ error: 'Gmail items cannot be shared' });

  // Verify there is an accepted connection between owner and target
  const conn = await prisma.shareConnection.findFirst({
    where: {
      fromUserId: req.user.id,
      toUserId: sharedWithUserId,
      status: 'accepted',
    },
  });
  if (!conn) return res.status(403).json({ error: 'No active sharing connection with that user' });

  if (shared) {
    await prisma.mailShare.upsert({
      where: { mailId_sharedWithUserId: { mailId: req.params.mailId, sharedWithUserId } },
      update: {},
      create: { mailId: req.params.mailId, sharedByUserId: req.user.id, sharedWithUserId },
    });
  } else {
    await prisma.mailShare.deleteMany({
      where: { mailId: req.params.mailId, sharedWithUserId },
    });
  }

  // Return updated list of users this item is shared with
  const shareList = await prisma.mailShare.findMany({
    where: { mailId: req.params.mailId, sharedByUserId: req.user.id },
    select: { sharedWithUserId: true },
  });
  res.json({ sharedWith: shareList.map((s) => s.sharedWithUserId) });
  } catch (err) {
    console.error('toggle mail share error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// ── GET /api/sharing/mail/:mailId/shares ─────────────────────────────────────
// Get the list of users this mail item is explicitly shared with

router.get('/mail/:mailId/shares', async (req, res) => {
  try {
  const mail = await prisma.mail.findFirst({ where: { id: req.params.mailId, userId: req.user.id } });
  if (!mail) return res.status(404).json({ error: 'Mail not found' });

  const shareList = await prisma.mailShare.findMany({
    where: { mailId: req.params.mailId, sharedByUserId: req.user.id },
    select: { sharedWithUserId: true },
  });
  res.json({ sharedWith: shareList.map((s) => s.sharedWithUserId) });
  } catch (err) {
    console.error('get mail shares error:', err);
    res.status(500).json({ error: 'Operation failed' });
  }
});

export { router as sharingRouter };
