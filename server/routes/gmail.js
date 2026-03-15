import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import prisma from '../services/db.js';
import { getAuthUrl, exchangeCode, syncGmail } from '../services/gmail.js';

const router = express.Router();

// All Gmail routes require authentication except the OAuth callback
// (callback carries a state param that ties it back to the user session)

// GET /api/gmail/auth — redirect user to Google OAuth consent screen
router.get('/auth', authenticate, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({ error: 'Gmail integration is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }
  const url = getAuthUrl();
  res.redirect(url);
});

// GET /api/gmail/callback — Google redirects here after user approves
router.get('/callback', authLimiter, async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/integrations?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect('/integrations?error=no_code');
  }

  // We need to know which user this belongs to.
  // The user must be logged in — read the session cookie directly.
  const cookieToken = req.cookies?.robin_session;
  if (!cookieToken) {
    return res.redirect('/integrations?error=not_authenticated');
  }

  let userId;
  try {
    const payload = jwt.verify(cookieToken, process.env.JWT_SECRET || 'robin-dev-secret-change-me');
    userId = payload.id;
  } catch {
    return res.redirect('/integrations?error=invalid_session');
  }

  try {
    const tokens = await exchangeCode(code);

    // Fetch the connected Gmail address
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    oauth2Client.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2Api.userinfo.get();

    await prisma.user.update({
      where: { id: userId },
      data: {
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token,
        gmailEmail: profile.email,
      },
    });

    res.redirect('/integrations?connected=true');
  } catch (err) {
    // SECURITY: Only log the message, not the full error (may contain tokens/PII)
    console.error('Gmail OAuth callback error:', err.message);
    res.redirect(`/integrations?error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/gmail/status — returns connection state
router.get('/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { gmailEmail: true, gmailRefreshToken: true },
  });
  res.json({
    connected: !!user?.gmailRefreshToken,
    email: user?.gmailEmail || null,
  });
});

// POST /api/gmail/sync — pull and process new actionable emails
router.post('/sync', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { gmailRefreshToken: true },
  });

  if (!user?.gmailRefreshToken) {
    return res.status(400).json({ error: 'Gmail is not connected' });
  }

  try {
    const result = await syncGmail(req.user.id);
    res.json(result); // { scanned, skipped, found }
  } catch (err) {
    if (err.message === 'Sync already in progress') {
      return res.status(409).json({ error: 'A sync is already in progress. Please wait.' });
    }
    console.error('Gmail sync error:', err);
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// DELETE /api/gmail/disconnect — revoke and clear tokens
router.delete('/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { gmailAccessToken: null, gmailRefreshToken: null, gmailEmail: null },
  });
  res.json({ success: true });
});

export { router as gmailRouter };
