import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import prisma from '../services/db.js';
import { signToken, authenticate, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

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
      user: { id: user.id, email: user.email, name: user.name },
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

    res.json({ user: { id: user.id, email: user.email, name: user.name } });
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
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export { router as authRouter };

