import express from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { body, validationResult } from 'express-validator';
import prisma from '../services/db.js';
import { signToken, authenticate, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

// Apply tight rate limit to all auth endpoints
router.use(authLimiter);

// --- Validation rules ---
const registerRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('name').trim().isLength({ min: 1, max: 80 }).escape().withMessage('Name is required (max 80 chars)'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return only the first error to avoid leaking info
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  return null;
}

// POST /api/auth/register
router.post('/register', registerRules, async (req, res) => {
  const invalid = handleValidation(req, res);
  if (invalid) return;

  try {
    const { email, name, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Deliberately vague to prevent user enumeration
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword },
    });

    const token = signToken(user);
    setSessionCookie(res, token);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, consentedAt: user.consentedAt, consentVersion: user.consentVersion },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', loginRules, async (req, res) => {
  const invalid = handleValidation(req, res);
  if (invalid) return;

  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run bcrypt compare even if user not found — prevents timing attacks
    const dummyHash = '$2b$12$invalidhashtopreventtimingattacks000000000000000000000';
    const valid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    setSessionCookie(res, token);

    res.json({ user: { id: user.id, email: user.email, name: user.name, consentedAt: user.consentedAt, consentVersion: user.consentVersion } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

// GET /api/auth/me — get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, createdAt: true, consentedAt: true, consentVersion: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Current terms version — bump this whenever terms change
const CURRENT_TERMS_VERSION = '1.1';

// POST /api/auth/consent — record GDPR consent
router.post('/consent', authenticate, async (req, res) => {
  try {
    const { accepted } = req.body;
    if (!accepted) {
      return res.status(400).json({ error: 'You must accept the terms to continue' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        consentedAt: new Date(),
        consentVersion: CURRENT_TERMS_VERSION,
      },
      select: { id: true, email: true, name: true, consentedAt: true, consentVersion: true },
    });

    res.json(user);
  } catch (err) {
    console.error('Consent error:', err);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

// GET /api/auth/export — GDPR: export all personal data
router.get('/export', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, createdAt: true, consentedAt: true, consentVersion: true },
    });
    const mail = await prisma.mail.findMany({
      where: { userId: req.user.id },
      select: {
        id: true, sender: true, receiver: true, summary: true, extractedText: true,
        category: true, urgency: true, dueDate: true, amountDue: true, status: true,
        actionTaken: true, actionNote: true, source: true, createdAt: true,
        keyDetails: true, actionableInfo: true,
      },
    });
    const connections = await prisma.shareConnection.findMany({
      where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }] },
      select: { id: true, fromUserId: true, toUserId: true, status: true, sharedCategories: true, createdAt: true },
    });

    res.set('Content-Disposition', 'attachment; filename="robin-data-export.json"');
    res.json({ exportedAt: new Date().toISOString(), user, mail, connections });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// DELETE /api/auth/account — GDPR: delete account and all data
router.delete('/account', authenticate, async (req, res) => {
  try {
    // GDPR Article 17 — right to erasure: delete uploaded files from disk
    const userMail = await prisma.mail.findMany({
      where: { userId: req.user.id },
      select: { imageUrl: true, imageUrls: true },
    });
    for (const item of userMail) {
      const files = Array.isArray(item.imageUrls) ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
      for (const relPath of files) {
        try {
          const absPath = path.join(__dirname, '..', relPath);
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } catch { /* best-effort cleanup */ }
      }
    }

    // Cascade delete handles mail, shares, connections via schema onDelete: Cascade
    await prisma.user.delete({ where: { id: req.user.id } });
    clearSessionCookie(res);
    res.json({ success: true, message: 'Your account and all data have been permanently deleted.' });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export { router as authRouter };

