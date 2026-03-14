# Robin — Product Description

## Overview

Robin is a smart postal mail management app. Point your phone camera at any piece of physical mail, and Robin will read it, understand it, and tell you what to do next.

It eliminates the pile of unopened mail sitting on your desk by giving every letter a summary, a category, and a clear next action — all in seconds.

---

## The Problem

Physical mail is tedious. Most people let it accumulate because:
- Opening and reading every piece takes time
- It's hard to remember which bills are due or what needs a response
- There's no searchable record of what arrived and when
- Family members may not know about important letters

---

## What Robin Does

### 1. Scan
Upload a photo or use your phone's camera to capture a piece of mail. Robin accepts images from any source — camera roll, file picker, or direct camera capture.

### 2. Read & Understand
Google Gemini (`gemini-3.1-pro-preview`) reads the document image directly — performing OCR and analysis in a single multimodal call. It produces:
- A **one-sentence summary** of what the letter is about
- The identified **sender** (person or organisation)
- A **category** from a fixed taxonomy
- An **urgency level** (low / medium / high)
- Any **amount due** and **due date** found in the text
- A list of **key details** extracted as bullet points

### 3. Suggest
Robin recommends the most appropriate next actions based on the content of the letter:

| Action | When suggested |
|--------|---------------|
| **Pay Bill** | Invoices, utility bills, payment demands |
| **Reply** | Letters requiring a response |
| **Schedule Follow-up** | Appointments, deadlines, renewals |
| **Archive** | Already handled or informational letters |
| **Mark as Important** | Legal, government, medical notices |
| **Discard** | Advertisements, junk mail |

### 4. Record
Every piece of scanned mail is stored with its image, extracted text, analysis, and the action you took. Your inbox is searchable and filterable.

---

## Mail Categories

| Category | Examples |
|----------|---------|
| `bill` | Utility bills, invoices, payment requests |
| `personal` | Letters from individuals, invitations |
| `government` | HMRC, DVLA, council notices |
| `legal` | Court notices, solicitor letters |
| `medical` | Hospital letters, appointment reminders, lab results |
| `insurance` | Policy updates, renewal notices, claims |
| `financial` | Bank statements, credit card letters |
| `tax` | Tax returns, assessment notices, P60s |
| `subscription` | Magazine renewals, membership notices |
| `advertisement` | Marketing, promotional offers |
| `other` | Anything that doesn't fit above |

---

## User Management

Each user has their own account with a private mail inbox. Mail scanned on one account is never visible to another.

- Email + password registration
- JWT-based authentication (tokens valid for 7 days)
- Passwords stored as bcrypt hashes
- All API routes are authenticated

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 16 (via Prisma ORM) |
| OCR + AI | Google Gemini (multimodal, single-call OCR + analysis) |
| Auth | JSON Web Tokens + bcrypt |
| Containerisation | Docker + Docker Compose |
| Reverse proxy | Nginx |

---

## Who Is It For

- **Individuals** who receive a lot of mail and want to stay on top of it
- **Households** where multiple people share financial responsibilities
- **Small businesses** managing supplier invoices and official correspondence
- **Anyone** who just wants their mail pile to stop being stressful
