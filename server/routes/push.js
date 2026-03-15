import express from 'express';
import prisma from '../services/db.js';
import { authenticate } from '../middleware/auth.js';
import { getVapidPublicKey, isPushConfigured } from '../services/push.js';

const router = express.Router();

router.use(authenticate);

// GET /api/push/vapid-public-key — client needs this to subscribe
router.get('/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(501).json({ error: 'Push notifications not configured on this server' });
  res.json({ key, enabled: isPushConfigured() });
});

// POST /api/push/subscribe — save (or update) a browser/device push subscription
router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: req.user.id, endpoint } },
    update: { p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  res.json({ success: true });
});

// DELETE /api/push/unsubscribe — remove a specific subscription (passed as body) or all
router.delete('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { userId: req.user.id, endpoint } });
  } else {
    await prisma.pushSubscription.deleteMany({ where: { userId: req.user.id } });
  }
  res.json({ success: true });
});

// GET /api/push/status — is this user subscribed on any device?
router.get('/status', async (req, res) => {
  const count = await prisma.pushSubscription.count({ where: { userId: req.user.id } });
  res.json({ subscribed: count > 0, deviceCount: count, enabled: isPushConfigured() });
});

export { router as pushRouter };
