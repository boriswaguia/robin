# Robin — TODO & Setup Checklist

This file tracks everything that needs to be done or configured before the app is fully operational.

---

## 1. Immediate: Gmail Integration Setup

The Gmail integration code is built but requires a one-time Google Cloud Console setup.

### 1.1 Create OAuth 2.0 Credentials

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Select (or create) a project
3. Navigate to **APIs & Services → Library**
4. Enable the following APIs:
   - **Gmail API**
   - **Google OAuth2 API** (People API / Google Identity)
5. Navigate to **APIs & Services → Credentials**
6. Click **Create Credentials → OAuth 2.0 Client ID**
7. Application type: **Web application**
8. Add Authorised Redirect URIs:
   - `http://localhost:3001/api/gmail/callback` — for local development
   - `https://your-domain.com/api/gmail/callback` — for production (add when ready)
9. Copy the **Client ID** and **Client Secret**

### 1.2 OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. User type: **External** (unless you have Google Workspace)
3. Fill in app name ("Robin"), support email, developer email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add your Gmail address as a **test user** (required while the app is in "Testing" mode)
6. For production, submit for **verification** if you want external users to connect Gmail

> While in Testing mode, only explicitly added test users can connect Gmail.

### 1.3 Add Environment Variables

**Local development (`server/.env`):**
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gmail/callback
```

**Production (Lightsail `.env`):**
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=https://robin.briskprototyping.com/api/gmail/callback
```

Then rebuild:
```bash
docker compose up -d
```

### 1.4 Test the Flow

1. Open Robin → click the ⚙ icon in the header → Integrations
2. Click **Connect Gmail**
3. Complete Google's consent screen
4. You should be redirected back with "Connected as your@gmail.com"
5. Click **Sync Now** — watch the Dashboard for newly processed items

---

## 2. Immediate: Update Deployment Docs

The `docs/deployment.md` prerequisites and environment variables table still references:
- `GOOGLE_CLOUD_API_KEY` (Google Cloud Vision API — **replaced by Gemini**)
- `OPENAI_API_KEY` (OpenAI — **replaced by Gemini**)

Update `docs/deployment.md`:
- Replace the prerequisites list to reference `GEMINI_API_KEY` only
- Update the environment variables table:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key — get free at https://ai.google.dev |
| `POSTGRES_PASSWORD` | **Yes** | PostgreSQL password |
| `JWT_SECRET` | **Yes** | Long random secret for session signing |
| `GOOGLE_CLIENT_ID` | No | For Gmail integration (OAuth2) |
| `GOOGLE_CLIENT_SECRET` | No | For Gmail integration (OAuth2) |
| `GOOGLE_REDIRECT_URI` | No | For Gmail integration (OAuth2 callback URL) |
| `DATABASE_URL` | Auto | Set automatically by Docker Compose |
| `PORT` | No | Server port, defaults to 3001 |

---

## 3. Immediate: Check for Stale `.env.docker`

There is a `.env.docker` in the repo root used as the production template. Verify it:
- [ ] Does **not** contain `GOOGLE_CLOUD_API_KEY` or `OPENAI_API_KEY`
- [ ] Contains `GEMINI_API_KEY`
- [ ] Contains `POSTGRES_PASSWORD` and `JWT_SECRET` placeholders
- [ ] Has commented-out `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

---

## 4. Security: Before Going Fully Public

These are outstanding items from `docs/security.md`. The app is usable but these should be addressed before promoting it widely.

### 4.1 HTTPS / TLS ⚠️ Required
The session cookie's `Secure` flag is disabled without HTTPS, meaning it can be sent over plain HTTP. See `docs/aws-lightsail.md` Section 5 for Caddy (simplest) or Certbot + Nginx options.

**Status:** Not done. Blocking for any real user data.

### 4.2 Refresh Token / Token Rotation — Optional
JWT sessions are valid for 7 days with no rotation. For higher security, consider short-lived access tokens (15 min) + refresh tokens (30 days).

**Status:** Not started. Low priority for now.

### 4.3 Audit Logging — Optional
No logging of auth events (login, failed login, logout). Useful for detecting compromise.

**Status:** Not started. Low priority for now.

### 4.4 Gmail Token Encryption at Rest — Recommended
`gmailAccessToken` and `gmailRefreshToken` are stored in plaintext in the database. If the DB is ever dumped, these tokens expose the user's Gmail read access.

Consider encrypting them with a server-side key (e.g. using Node's `crypto.createCipheriv`) before persisting.

**Status:** Not started.

---

## 5. Gmail Integration: Future Improvements

### 5.1 Auto-sync on Login
Currently sync is manual (user clicks "Sync Now"). Add an automatic sync trigger when the user logs in — only if Gmail is connected and last sync was > 30 minutes ago. Store `gmailLastSyncAt` on the User model.

### 5.2 Sync History / Status
Show the user when the last sync ran and how many items were found. Store sync metadata in a new `GmailSync` table or as a JSON field on User.

### 5.3 Sender Watchlist
Let users add trusted sender domains (e.g. `ing.de`, `stadtwerke-muenchen.de`). These bypass the Tier 2 AI filter and are always analyzed. Store as a JSON array on User.

### 5.4 Per-email Feedback Loop
Add a "Not relevant / hide" action specific to Gmail items. Store rejections to improve the filter over time (e.g. block that sender domain from future imports).

### 5.5 Gmail Thread Linking
When a Gmail message is part of a thread, attempt to match it with an existing Robin mail item from the same thread. The `threadId` field on the Gmail message can be used for this.

---

## 6. Features: Nice to Have

### 6.1 Household / Shared Inbox
The product targets households but every account is fully siloed today. A shared inbox or "send to household member" feature would make Robin sticky for families. Requires:
- A `Household` model
- Invite flow (email invite link)
- Shared mail visibility with per-user action state

### 6.2 Progressive Web App Improvements
The `client/public/manifest.json` exists but:
- [ ] Verify icons are present and correct sizes (192x192, 512x512)
- [ ] Test "Add to Home Screen" on iOS Safari and Android Chrome
- [ ] Add a service worker for offline support (at minimum: cache the shell, show offline page)

### 6.3 Dependency Audit
```bash
cd server && npm audit --audit-level=high
cd ../client && npm audit --audit-level=high
```
There are currently 3 high severity vulnerabilities in server deps (noted during `npm install googleapis`). Run `npm audit` to review.

---

## 7. Quick Reference: Environment Variables (Complete)

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `GEMINI_API_KEY` | server | **Yes** | Gemini API — OCR + AI analysis. Get free at https://ai.google.dev |
| `POSTGRES_PASSWORD` | root `.env` | **Yes** | PostgreSQL password |
| `JWT_SECRET` | server | **Yes** | Session signing secret. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | server | Gmail only | OAuth2 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | server | Gmail only | OAuth2 Client Secret |
| `GOOGLE_REDIRECT_URI` | server | Gmail only | `http://localhost:3001/api/gmail/callback` (dev) or `https://your-domain.com/api/gmail/callback` (prod) |
| `DATABASE_URL` | server | Auto | Set by Docker Compose. For local dev: `postgresql://robin:robin_secret@localhost:5433/robin?schema=public` |
| `PORT` | server | No | Defaults to `3001` |
| `NODE_ENV` | server | No | Set to `production` in Docker. Enables `Secure` cookie flag. |
