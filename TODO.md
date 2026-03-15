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

## 1.5 Submit App to Google for OAuth Verification

While in **Testing** mode, only explicitly added test users can connect Gmail. To allow any user to connect, the app must pass Google's OAuth verification review.

### Prerequisites (all completed ✅)

- [x] **No sensitive email data in server logs** — all `console.error` calls sanitized to log only error messages, never email content, tokens, or Gemini raw responses
- [x] **Gmail OAuth tokens encrypted at rest** — `gmailAccessToken` and `gmailRefreshToken` are now encrypted via AES-256-GCM through the Prisma middleware (db.js)
- [x] **DSGVO/GDPR-compliant consent screen** — expanded to cover Gmail-specific data processing, AI pre-filtering, automated decision-making (Art. 22), data transfer outside EEA, and explicit mention of all scopes
- [x] **Consent version bumped to 1.1** — existing users will be prompted to re-accept updated terms
- [x] **Data export and deletion** — GDPR rights (access, rectify, erase, portability) fully implemented
- [x] **Minimal scopes** — only `gmail.readonly` and `userinfo.email` requested
- [x] **No email sending/modifying** — app uses read-only access

### Step-by-step: Google OAuth Verification Submission

1. **Deploy production build** with all security fixes applied:
   ```bash
   docker compose up -d --build
   ```

2. **Set up HTTPS** (required for verification):
   - Configure Caddy or Certbot + Nginx for TLS (see `docs/aws-lightsail.md` Section 5)
   - Update `GOOGLE_REDIRECT_URI` to `https://robin.briskprototyping.com/api/gmail/callback`
   - Google will not approve apps using HTTP

3. **Prepare a public-facing privacy policy page**:
   - Host the privacy policy at a publicly accessible URL (e.g. `https://robin.briskprototyping.com/privacy`)
   - It must be accessible **without authentication**
   - Must clearly describe: what data is collected, how it's used, how it's shared, how users can delete their data
   - The consent screen text in `ConsentScreen.jsx` covers all required content — create a standalone HTML page from it

4. **Prepare a public-facing homepage**:
   - Google requires a homepage URL that explains what the app does
   - Can be a simple landing page at `https://robin.briskprototyping.com/` or a dedicated page

5. **Record a demo video** (required by Google):
   - Show the OAuth flow from start to finish
   - Show the user clicking "Connect Gmail" → Google consent screen → redirect back to app
   - Show what the app does with the data (email sync, analysis results in dashboard)
   - Show how users can disconnect Gmail and delete their account
   - Upload to YouTube as unlisted (2-5 minutes)

6. **Go to Google Cloud Console → OAuth consent screen**:
   - Fill in all fields:
     - **App name**: Robin
     - **User support email**: your contact email
     - **App logo**: upload your app icon (at least 120x120px)
     - **Application homepage link**: `https://robin.briskprototyping.com`
     - **Application privacy policy link**: `https://robin.briskprototyping.com/privacy`
     - **Application terms of service link**: `https://robin.briskprototyping.com/terms` (can be same as privacy page)
     - **Authorized domains**: `briskprototyping.com`
     - **Developer contact email**: your email

7. **Verify scopes**:
   - Ensure only these scopes are listed:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
   - `gmail.readonly` is a **restricted scope** — this triggers a more thorough review

8. **Submit for verification**:
   - Click **"Publish App"** to move from Testing to In Production
   - Google will show a "Verification required" banner — click **"Prepare for verification"**
   - Fill in the form:
     - Explain why you need each scope
     - For `gmail.readonly`: *"Robin reads the user's inbox (last 7 days only) to identify actionable correspondence such as bills, appointments, and legal notices. It uses AI to extract structured data like due dates and amounts. Robin does not send, modify, or delete any emails. Users can disconnect Gmail at any time."*
     - Provide the YouTube demo video link
     - Provide the privacy policy URL
   - Submit

9. **Respond to Google's review**:
   - Google may request a **security assessment** (CASA Tier 2) for restricted scopes like `gmail.readonly`
   - This involves a third-party security audit — budget ~$4,500–$15,000 USD and 4-8 weeks
   - Alternatively, if your app has fewer than 100 users, you may qualify for a **self-assessment** (free)
   - Google may also ask clarifying questions — respond promptly

10. **After approval**:
    - The "unverified app" warning screen is removed
    - Any Google user can connect their Gmail to Robin
    - Keep the privacy policy and homepage URLs active permanently
    - If you change scopes, you must re-verify

### Important Notes

- **Restricted scopes require CASA security assessment**: `gmail.readonly` is classified as a restricted scope. Google requires either a self-assessment or a third-party CASA (Cloud Application Security Assessment). For apps with fewer than 100 users, self-assessment may be available.
- **Timeline**: The review typically takes 4-6 weeks. If a security assessment is required, add another 4-8 weeks.
- **Keep test users**: Until verification is complete, keep your Gmail address listed as a test user so you can continue developing.
- **Annual re-verification**: Google may require periodic re-verification for restricted scopes.

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

### 4.4 Gmail Token Encryption at Rest — ✅ Done
`gmailAccessToken` and `gmailRefreshToken` are now encrypted at rest using AES-256-GCM via the Prisma middleware in `server/services/db.js`. The encryption is transparent — tokens are encrypted before writing to the DB and decrypted after reading.

**Status:** Completed (March 2026).

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
