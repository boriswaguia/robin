# Robin — Security

This document describes the security measures in place and the threats they address.

---

## Threat Model

Robin handles sensitive data: images and text of personal mail, which can contain account numbers, addresses, medical information, tax data, and financial details. The primary threats are:

| Threat | Impact |
|--------|--------|
| Stolen session token (XSS) | Attacker reads all your mail |
| Brute-force login | Attacker gains account access |
| Cross-site request forgery (CSRF) | Attacker performs actions on your behalf |
| Data leak between users | One user sees another's mail |
| Database exposure | All users' data stolen in one breach |
| API key theft | Attacker runs up OCR/AI bills |

---

## Controls Implemented

### 1. Session Tokens — httpOnly Cookies (not localStorage)

**Threat blocked:** XSS-based session theft.

JWT sessions are stored in an `httpOnly` cookie, not `localStorage` or `sessionStorage`. This means:
- JavaScript running on the page **cannot read the token** — even if malicious code is injected
- The cookie is automatically sent with every request by the browser
- `SameSite=Strict` means the cookie is never sent from a cross-site page, defeating CSRF attacks without needing a CSRF token

```
Set-Cookie: robin_session=<jwt>; HttpOnly; SameSite=Strict; Secure; Max-Age=604800
```

`Secure` is only set when `NODE_ENV=production` to allow development over HTTP.

---

### 2. HTTP Security Headers — Helmet.js

**Threat blocked:** XSS, clickjacking, MIME sniffing, information leakage.

[Helmet](https://helmetjs.github.io/) sets the following headers on every response:

| Header | Protection |
|--------|-----------|
| `Content-Security-Policy` | Blocks loading scripts/styles from foreign domains |
| `X-Frame-Options: SAMEORIGIN` | Prevents clickjacking via iframes |
| `X-Content-Type-Options: nosniff` | Prevents MIME sniffing attacks |
| `Strict-Transport-Security` | Forces HTTPS in production |
| `X-DNS-Prefetch-Control: off` | Reduces information leakage |
| `Referrer-Policy: no-referrer` | Doesn't send referer headers externally |

---

### 3. Rate Limiting

**Threat blocked:** Brute-force login, credential stuffing, API abuse.

Two layers of rate limiting:

| Limiter | Endpoint | Limit |
|---------|----------|-------|
| Auth limiter | `/api/auth/*` | 10 requests / 15 min / IP |
| API limiter | `/api/*` | 120 requests / min / IP |

---

### 4. Input Validation and Sanitisation

**Threat blocked:** Malformed input, injection attempts, overlong payloads.

All auth endpoints use [express-validator](https://express-validator.github.io/docs/):
- Email is validated and normalised (lowercased, trimmed)
- Name is trimmed, escaped, and length-capped at 80 characters
- Passwords enforced to a minimum of 8 characters
- Request body size is capped at 1 MB (prevents payload bombs)

---

### 5. Password Hashing — bcrypt

**Threat blocked:** Database breach exposing plaintext passwords.

Passwords are hashed with bcrypt at cost factor 12 before storage. The plaintext password is never written anywhere. Even a full database dump does not expose passwords.

---

### 6. Timing-Safe Login

**Threat blocked:** User enumeration via response timing.

During login, a bcrypt comparison is always performed — even when the email does not exist. This means the response time is identical whether the email is found or not, preventing an attacker from enumerating valid accounts by measuring response speed.

---

### 7. Per-User Data Isolation

**Threat blocked:** Horizontal privilege escalation (user A reading user B's mail).

Every database query for mail includes a `userId` condition tied to the authenticated user's ID. A valid session for user A cannot retrieve, update, or delete any record belonging to user B, regardless of the item's ID.

---

### 8. CORS Policy

**Threat blocked:** Malicious websites making credentialed requests to the API.

In **development**, CORS is configured to only allow requests from known local origins (`localhost:5173`, `localhost:80`, `localhost`). In **production**, the Express server is never publicly exposed — it sits behind an nginx reverse proxy that owns the only external port (80/443). Since the browser only ever talks to one origin (nginx), CORS restrictions are not needed and the server reflects the request origin. Credentials (cookies) require `credentials: true`.

---

### 9. Database Not Exposed to the Host

**Threat blocked:** Direct database access from outside the server.

In the Docker Compose setup, PostgreSQL has no port mapping to the host. It is only reachable from within the Docker internal network by the `server` container. The Express API is similarly not exposed — only Nginx on port 80 is reachable from outside.

---

### 10. Parameterised Queries via Prisma

**Threat blocked:** SQL injection.

All database access goes through Prisma ORM, which uses parameterised prepared statements. User-supplied strings are never interpolated into SQL queries.

---

## What to Add Before Going to Production

These controls are **not yet implemented** and should be added before exposing Robin to the public internet:

### HTTPS (TLS)

Without HTTPS, the session cookie and all mail content is transmitted in plaintext.

Option A — Caddy (automatic certificate):
```
yourdomain.com {
    reverse_proxy localhost:80
}
```

Option B — Nginx with Certbot:
```bash
certbot --nginx -d yourdomain.com
```

Once HTTPS is in place, set `NODE_ENV=production` and the cookie's `Secure` flag activates automatically.

---

### Uploaded File Access Controls

Uploaded mail images are served through an authenticated route (`server/routes/uploads.js`). Every request to `/uploads/:filename` requires a valid session and verifies that the authenticated user owns a mail item referencing the file. Unauthenticated or unauthorised access returns 403.

---

### Refresh Tokens / Token Rotation

Currently sessions expire after 7 days without any rotation. Consider issuing short-lived access tokens (15 min) and refresh tokens (30 days) for tighter session control.

---

### Audit Logging

Log authentication events (login, failed login, logout, password change) to a separate append-only table or log stream. This allows you to detect account compromise after the fact.

---

### Dependency Scanning

Run `npm audit` regularly and integrate it into CI:
```bash
npm audit --audit-level=high
```

---

## Quick Reference: Security Checklist

| Item | Status | Notes |
|------|--------|-------|
| httpOnly session cookie | ✅ Done | No JS access to token |
| HTTP security headers | ✅ Done | Helmet.js |
| Auth rate limiting | ✅ Done | 10 req/15 min |
| Input validation | ✅ Done | express-validator |
| Bcrypt passwords | ✅ Done | Cost factor 12 |
| Timing-safe login | ✅ Done | Always run bcrypt |
| Per-user data isolation | ✅ Done | userId on all queries |
| CORS policy | ✅ Done | Allowlist in dev; server not exposed in prod |
| DB not exposed to host | ✅ Done | Docker internal network |
| Parameterised queries | ✅ Done | Prisma ORM |
| HTTPS / TLS | ⚠️ Required | Add before going live |
| Uploaded file auth | ✅ Done | Authenticated + ownership verified |
| Token rotation | ⚠️ Optional | Add for high-security use |
| Audit logging | ⚠️ Optional | Add for compliance |
