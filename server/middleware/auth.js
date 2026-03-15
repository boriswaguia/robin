import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

/**
 * Express middleware to verify auth.
 * Checks httpOnly cookie first (browsers), then Authorization: Bearer header (API clients).
 * Adds req.user = { id, email, name } on success.
 */
export async function authenticate(req, res, next) {
  // 1. Prefer the httpOnly cookie — not accessible to JS, XSS-proof
  const cookieToken = req.cookies?.robin_session;

  // 2. Fall back to Bearer token in Authorization header (for API/mobile clients)
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Verify the token hasn't been revoked (tokenVersion must match DB)
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, tokenVersion: true },
    });
    if (!user || payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Session has been revoked. Please log in again.' });
    }
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

/**
 * Sign a JWT for a user.
 */
export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, tokenVersion: user.tokenVersion ?? 0 },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Set the httpOnly session cookie on a response.
 */
export function setSessionCookie(res, token) {
  const IS_PROD = process.env.NODE_ENV === 'production';
  res.cookie('robin_session', token, {
    httpOnly: true,          // not accessible via JavaScript
    secure: IS_PROD,         // HTTPS only in production
    sameSite: 'lax',         // allows top-level GET navigations (OAuth redirects, external links)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear the session cookie (for logout).
 */
export function clearSessionCookie(res) {
  const IS_PROD = process.env.NODE_ENV === 'production';
  res.clearCookie('robin_session', { httpOnly: true, secure: IS_PROD, sameSite: 'lax', path: '/' });
}

