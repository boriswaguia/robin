import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import prisma from './db.js';
import { analyzeMail, analyzeEmailText, findRelatedMail } from './ai.js';
import { saveMail, updateMail, getAllMail } from './storage.js';
import { encryptBuffer, isEncryptionEnabled } from './crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// ── OAuth2 helpers ──────────────────────────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(state) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent', // always return a refresh token
    state,             // CSRF protection — verified in callback
  });
}

export async function exchangeCode(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function getGmailClient(user) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: user.gmailAccessToken,
    refresh_token: user.gmailRefreshToken,
  });

  // Persist refreshed access token automatically
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.user.update({
        where: { id: user.id },
        data: { gmailAccessToken: tokens.access_token },
      });
    }
  });

  return google.gmail({ version: 'v1', auth: client });
}

// ── Tier 1: rule-based filter (free, <1ms) ──────────────────────────────────

function passesTier1(message) {
  const headers = message.payload?.headers || [];
  const h = (name) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Bulk/automated mail signal
  if (h('Precedence').toLowerCase() === 'bulk') return false;

  // Gmail category labels — trust Google's classification
  const labels = message.labelIds || [];
  if (labels.includes('CATEGORY_PROMOTIONS')) return false;
  if (labels.includes('CATEGORY_SOCIAL')) return false;
  if (labels.includes('CATEGORY_FORUMS')) return false;

  return true;
}

// ── Tier 2: Gemini Flash pre-filter (~100 tokens, ~$0.00001/email) ──────────

async function passesTier2(subject, sender, snippet) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an email triage assistant. Does this email require the recipient to take action (pay a bill, respond, attend an appointment, upload a document, deal with a legal/financial/government/medical matter, or handle anything with a deadline)?

Sender: ${sender}
Subject: ${subject}
Preview: ${snippet}

Answer ONLY "yes" or "no".`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim().toLowerCase().startsWith('yes');
  } catch {
    return true; // fail open — let the full analysis decide
  }
}

// ── Recursive MIME part extractor ───────────────────────────────────────────

async function extractParts(gmail, messageId, part, attachmentPaths, textChunks) {
  if (!part) return;

  if (part.parts) {
    for (const p of part.parts) {
      await extractParts(gmail, messageId, p, attachmentPaths, textChunks);
    }
    return;
  }

  const mime = part.mimeType || '';

  // Plain-text body (prefer plain over HTML)
  if (mime === 'text/plain' && part.body?.data) {
    textChunks.push(Buffer.from(part.body.data, 'base64').toString('utf-8'));
    return;
  }

  // HTML body — strip tags as fallback when no text/plain is available
  if (mime === 'text/html' && part.body?.data) {
    const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text) textChunks.push(text);
    return;
  }

  // PDF or image attachment
  const isImage = /^image\//.test(mime);
  const isPdf = mime === 'application/pdf';
  if (part.filename && part.body?.attachmentId && (isImage || isPdf)) {
    const attRes = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: part.body.attachmentId,
    });

    const ext = path.extname(part.filename) || (isPdf ? '.pdf' : '.jpg');
    const filename = `${uuid()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    let buf = Buffer.from(attRes.data.data, 'base64');
    // Encrypt attachments at rest (same as camera-scan pipeline)
    if (isEncryptionEnabled()) buf = encryptBuffer(buf);
    fs.writeFileSync(filePath, buf);
    attachmentPaths.push(filePath);
  }
}

// ── Background analysis (mirrors processMailAsync in mail routes) ────────────

async function analyzeGmailItem(mailId, userId, attachmentPaths, emailBody, subject, sender) {
  try {
    let analysis;

    if (attachmentPaths.length > 0) {
      // Use image/PDF pipeline — same as camera scan
      analysis = await analyzeMail(attachmentPaths);
    } else {
      // Text-only email — pass body + metadata directly to Gemini
      analysis = await analyzeEmailText(emailBody, subject, sender);
    }

    // ── Infer due date for urgent items with no explicit date ──────────────
    if (!analysis.dueDate && analysis.urgency === 'high') {
      const actions = analysis.suggestedActions || [];
      const needsAction = actions.includes('pay_bill') || actions.includes('schedule_followup');
      if (needsAction) {
        analysis.dueDate = new Date().toISOString().split('T')[0];
        console.log(`Gmail mail ${mailId}: inferred dueDate=${analysis.dueDate} (urgent item with no explicit date)`);
      }
    }

    // Auto-reminder: 2 days before due date
    let reminderAt = null;
    if (analysis.dueDate) {
      try {
        const due = new Date(analysis.dueDate);
        const reminder = new Date(due.getTime() - 2 * 24 * 60 * 60 * 1000);
        reminderAt = reminder > new Date() ? reminder : due > new Date() ? new Date() : null;
      } catch { /* invalid date */ }
    }

    // Thread detection
    let threadId = mailId;
    try {
      const existing = await getAllMail(userId);
      const candidates = existing.filter((m) => m.id !== mailId && m.status !== 'processing');
      const matchedId = await findRelatedMail(analysis, candidates);
      if (matchedId) {
        const matched = candidates.find((m) => m.id === matchedId);
        if (matched) threadId = matched.threadId || matched.id;
      }
    } catch { /* non-fatal */ }

    await updateMail(mailId, userId, {
      extractedText: analysis.extractedText || '',
      summary: analysis.summary,
      sender: (analysis.sender && analysis.sender !== 'Unknown') ? analysis.sender : sender || null,
      receiver: (analysis.receiver && analysis.receiver !== 'Unknown') ? analysis.receiver : null,
      category: analysis.category,
      urgency: analysis.urgency,
      dueDate: analysis.dueDate || null,
      amountDue: analysis.amountDue || null,
      suggestedActions: analysis.suggestedActions || [],
      keyDetails: analysis.keyDetails || [],
      actionableInfo: analysis.actionableInfo || [],
      threadId,
      reminderAt,
      status: 'new',
      installmentLabel: Array.isArray(analysis.installments) ? analysis.installments[0]?.label || 'Installment 1' : null,
    });

    // ── Create child items for remaining installments ────────────────────
    if (Array.isArray(analysis.installments) && analysis.installments.length > 1) {
      const total = analysis.installments.length;
      await updateMail(mailId, userId, { installmentLabel: `${analysis.installments[0]?.label || 'Rate 1'} (1/${total})` });

      for (let i = 1; i < analysis.installments.length; i++) {
        const inst = analysis.installments[i];
        const instDueDate = inst.dueDate;
        let instReminderAt = null;
        if (instDueDate) {
          try {
            const due = new Date(instDueDate);
            const rem = new Date(due.getTime() - 2 * 24 * 60 * 60 * 1000);
            if (rem > new Date()) instReminderAt = rem;
            else if (due > new Date()) instReminderAt = new Date();
          } catch { /* skip */ }
        }

        await saveMail({
          userId,
          imageUrl: null,
          imageUrls: null,
          extractedText: analysis.extractedText || '',
          summary: `${analysis.summary || ''} — ${inst.label || `Installment ${i + 1}`}`,
          sender: (analysis.sender && analysis.sender !== 'Unknown') ? analysis.sender : sender || null,
          receiver: (analysis.receiver && analysis.receiver !== 'Unknown') ? analysis.receiver : null,
          category: analysis.category,
          urgency: analysis.urgency,
          dueDate: instDueDate || null,
          amountDue: inst.amount || null,
          suggestedActions: analysis.suggestedActions || [],
          keyDetails: analysis.keyDetails || [],
          actionableInfo: analysis.actionableInfo || [],
          threadId,
          reminderAt: instReminderAt,
          status: 'new',
          source: 'gmail',
          parentId: mailId,
          installmentLabel: `${inst.label || `Rate ${i + 1}`} (${i + 1}/${total})`,
        });
      }
      console.log(`Created ${analysis.installments.length - 1} installment items for Gmail mail ${mailId}`);
    }

    console.log(`Gmail item ${mailId} analyzed successfully`);
  } catch (err) {
    const isRejected = err.code === 'DOCUMENT_REJECTED';
    await updateMail(mailId, userId, {
      status: isRejected ? 'rejected' : 'error',
      extractedText: `${isRejected ? 'Rejected' : 'Error'}: ${err.message}`,
    }).catch(() => {});
    throw err;
  }
}

// ── Concurrency guard ────────────────────────────────────────────────────────

const activeSyncs = new Set();

/** Check if a sync is currently running for a user */
export function isSyncActive(userId) {
  return activeSyncs.has(userId);
}

// ── Main sync function ───────────────────────────────────────────────────────

export async function syncGmail(userId) {
  if (activeSyncs.has(userId)) throw new Error('Sync already in progress');
  activeSyncs.add(userId);

  // Create a sync record to track progress
  const syncRecord = await prisma.gmailSync.create({
    data: { userId, status: 'in_progress' },
  });

  try {
    const result = await _doSync(userId, syncRecord.id);
    // Mark sync as completed with final counts
    await prisma.gmailSync.update({
      where: { id: syncRecord.id },
      data: { status: 'completed', completedAt: new Date(), ...result },
    });
    return result;
  } catch (err) {
    await prisma.gmailSync.update({
      where: { id: syncRecord.id },
      data: { status: 'error', completedAt: new Date(), error: err.message },
    }).catch(() => {});
    throw err;
  } finally {
    activeSyncs.delete(userId);
  }
}

async function _doSync(userId, syncId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.gmailRefreshToken) throw new Error('Gmail not connected');

  const gmail = await getGmailClient(user);

  // Last 7 days, inbox only
  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${sevenDaysAgo} in:inbox`,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];
  let scanned = 0;
  let skipped = 0;
  let found = 0;

  for (const { id } of messages) {
    try {
      // Skip duplicates
      const existing = await prisma.mail.findFirst({ where: { userId, gmailMessageId: id } });
      if (existing) { skipped++; continue; }

      // Fetch full message
      const { data: msg } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      scanned++;

      // Update live counts periodically (every 5 messages)
      if (scanned % 5 === 0) {
        await prisma.gmailSync.update({
          where: { id: syncId },
          data: { scanned, skipped, found },
        }).catch(() => {});
      }

      // Tier 1
      if (!passesTier1(msg)) continue;

      const headers = msg.payload?.headers || [];
      const h = (name) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || '';
      const subject = h('Subject');
      const sender = h('From');
      const snippet = msg.snippet || '';

      // Tier 2
      if (!(await passesTier2(subject, sender, snippet))) continue;

      found++;

      // Extract body text and attachments
      const attachmentPaths = [];
      const textChunks = [];
      await extractParts(gmail, id, msg.payload, attachmentPaths, textChunks);
      const emailBody = textChunks.join('\n').slice(0, 8000); // cap at 8k chars

      // Save placeholder immediately (polling will show it as processing)
      const mailItem = await saveMail({
        userId,
        imageUrl: attachmentPaths.length > 0 ? `/uploads/${path.basename(attachmentPaths[0])}` : null,
        imageUrls: attachmentPaths.map((p) => `/uploads/${path.basename(p)}`),
        source: 'gmail',
        gmailMessageId: id,
        status: 'processing',
      });

      // Analyze in background — same pattern as camera scan
      analyzeGmailItem(mailItem.id, userId, attachmentPaths, emailBody, subject, sender).catch((err) => {
        console.error(`Background Gmail analysis failed for ${id}:`, err.message);
      });
    } catch (err) {
      console.error(`Error processing Gmail message ${id}:`, err.message);
    }
  }

  return { scanned, skipped, found };
}
