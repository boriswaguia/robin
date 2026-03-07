# Robin — Feature Changelog

All features added to Robin beyond the initial scaffold.

---

## AI & Document Understanding

### Unified Gemini OCR + Analysis
Single multimodal Gemini API call reads the document image, extracts all text (OCR), and produces structured analysis in one step. No separate OCR service needed. Model: `gemini-3.1-pro-preview`, max 20 000 output tokens.

### Contextual Actionable Info Extraction
Instead of fixed fields, Gemini extracts whatever the recipient needs to take action — tailored to the document type:
- **Bills / Invoices** → IBAN, BIC, recipient, payment reference, invoice number, payment portal
- **Government** → case/file number (Aktenzeichen), office address, required documents
- **Legal** → case number, court, hearing date, attorney contact, response deadline
- **Medical** → appointment date/time, clinic address, what to bring, patient ID
- **Insurance** → policy number, claim number, agent contact
- **Tax** → tax ID (Steuernummer), filing deadline, Finanzamt address
- **Subscriptions** → member ID, renewal deadline, portal URL

Each field is marked `copyable` so the user can tap to copy values directly into their banking app, browser, etc.

### Receiver Extraction
Gemini extracts the **recipient** of the mail (who it is addressed to), in addition to the sender. Enables per-person mail filtering and directory organisation.

---

## Async Processing

Uploads return immediately (HTTP 202). Gemini analysis runs in the background. The dashboard auto-polls every 3 seconds and updates cards from *Processing…* → content without any manual refresh.

---

## PDF Support

- Scanner accepts `.pdf` files in addition to images
- PDF preview shows a file icon instead of a broken image
- MailDetail renders PDFs in an `<iframe>` embed
- Helmet CSP updated to allow `frame-src: self` for iframes

---

## Thread Detection — Related Mail

After analysing a new scan, a second lightweight Gemini call compares it against existing mail to detect follow-ups, reminders, second notices, and continuations. Matched items are grouped into a thread via a shared `threadId`.

MailDetail shows a **Related Mail** timeline for all items in the same thread — with dates, summaries, actions taken, and navigation links between them.

---

## Directory

New **Directory** tab (bottom nav) showing all contacts extracted from scanned mail:
- Separate entries for **senders** (organisations that wrote to you) and **receivers** (household members the mail was addressed to)
- Mail count, category tags, and last activity date per contact
- Filter by Senders / Receivers, search by name
- Tap a contact → full mail history grouped by sent/received

---

## Search

Search panel on the Dashboard (tap the Search button in the stats row):
- Full-text search across sender, receiver, summary, and extracted text
- Filter by sender name or receiver name independently
- Date range picker (from / to)
- Combinable with existing category filter chips

---

## Calendar

### .ics Export (Add to Calendar)
"Add to Calendar" button on MailDetail when a due date is present. Generates a standard `.ics` file with two VALARM reminders (1 day before and 1 hour before). Uses Web Share API on mobile (opens native calendar picker), falls back to file download on desktop.

### Built-in Calendar View
New **Calendar** tab showing a full monthly grid:
- Coloured dots on dates that have mail with due dates
- Click any date to see all mail items due that day
- Per-item .ics export from the calendar view
- Prev / Next month navigation with "Today" shortcut

---

## SEPA Payment

"Pay via SEPA" button on MailDetail when an IBAN is detected in the extracted actionable info. Opens a bottom-sheet modal with two tabs:

### EPC GiroCode QR (ISO 20022 / EPC069-12)
Client-side QR code pre-filled with recipient, IBAN, BIC, amount, and payment reference (Verwendungszweck). Scannable by all major European banking apps: Sparkasse, DKB, ING, N26, Comdirect, Volksbank, Revolut, and more.

### payto:// Deep Link (RFC 8905)
Tap "Open in Banking App" to launch the user's default banking app with payment details pre-filled. Supported by Sparkasse, DKB, Volksbank, Postbank, Commerzbank, ING Germany.

### Share Payment Details
Share button copies SEPA details as plain text — uses Web Share API on mobile (native share sheet), clipboard on desktop.

---

## Security

- **httpOnly cookies** — session token stored in `robin_session` cookie, never in localStorage
- **Helmet.js** — comprehensive HTTP security headers including CSP
- **Rate limiting** — auth endpoints: 10 req / 15 min; API: 120 req / min
- **Input validation** — `express-validator` on all auth routes
- **Timing-safe login** — bcrypt compare always runs to prevent user enumeration
- **CORS allowlist** — restricted to known origins
- **Parameterised queries** — Prisma ORM prevents SQL injection

---

## Infrastructure

- **PostgreSQL 16 + Prisma ORM** — full persistence, schema migrations tracked in `server/prisma/migrations/`
- **Docker Compose** — `db`, `server`, `client` (nginx) services with named volumes
- `docker-compose.override.yml` for local dev (maps Postgres to port 5433 to avoid conflict with local installs)
- `.env.docker` for production container secrets
