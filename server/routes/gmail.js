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

const JWT_SECRET = process.env.JWT_SECRET || 'robin-dev-secret-change-me';

// GET /api/gmail/auth — redirect user to Google OAuth consent screen
router.get('/auth', authenticate, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({ error: 'Gmail integration is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }

  // Sign a short-lived state token: prevents OAuth CSRF and identifies
  // the user in the callback without relying on the session cookie
  // (SameSite cookies aren't sent on cross-site redirects from Google).
  const state = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '10m' });

  const url = getAuthUrl(state);
  res.redirect(url);
});

// GET /api/gmail/callback — Google redirects here after user approves
router.get('/callback', authLimiter, async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.redirect('/integrations?error=oauth_denied');
  }
  if (!code) {
    return res.redirect('/integrations?error=no_code');
  }

  // Verify the signed state token (CSRF protection + user identification).
  // This replaces the old approach of reading the session cookie, which
  // failed with SameSite cookies on cross-site redirects from Google.
  if (!state) {
    return res.redirect('/integrations?error=missing_state');
  }

  let userId;
  try {
    const payload = jwt.verify(state, JWT_SECRET);
    userId = payload.userId;
  } catch {
    return res.redirect('/integrations?error=invalid_state');
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
    // Don't reflect raw error messages in the URL — use a generic code
    res.redirect('/integrations?error=oauth_failed');
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
    // Detect insufficient scopes — user needs to disconnect and reconnect
    if (err.code === 403 || err.status === 403 || /insufficient.*scop/i.test(err.message)) {
      console.error('Gmail scope error — user needs to reconnect:', err.message);
      return res.status(403).json({
        error: 'Gmail permissions are outdated. Please disconnect and reconnect your Gmail account.',
        reconnect: true,
      });
    }
    // Detect revoked/expired refresh token
    if (err.code === 401 || err.status === 401 || /invalid_grant|token.*revoked|token.*expired/i.test(err.message)) {
      console.error('Gmail token expired/revoked:', err.message);
      return res.status(401).json({
        error: 'Gmail access has expired. Please disconnect and reconnect your Gmail account.',
        reconnect: true,
      });
    }
    console.error('Gmail sync error:', err.message);
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
