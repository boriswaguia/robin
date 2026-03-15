import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import prisma from '../services/db.js';
import { analyzeMail, findRelatedMail, analyzeVoice } from '../services/ai.js';
import { getAllMail, getMailById, saveMail, updateMail, deleteMail, getRelatedMail, searchMail, getContacts, getMailByContact, getDueReminders } from '../services/storage.js';
import { authenticate } from '../middleware/auth.js';
import { encryptBuffer, isEncryptionEnabled } from '../services/crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// All mail routes require authentication
router.use(authenticate);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp|tiff|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  },
});

// POST /api/mail/scan — upload & queue async processing (supports multi-page: up to 10 images)
router.post('/scan', upload.array('images', 10), async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No image file(s) provided' });
    }

    const imageUrls = files.map((f) => `/uploads/${f.filename}`);
    const imagePaths = files.map((f) => f.path);

    // Encrypt uploaded files on disk if encryption is enabled
    if (isEncryptionEnabled()) {
      for (const fp of imagePaths) {
        const plain = fs.readFileSync(fp);
        fs.writeFileSync(fp, encryptBuffer(plain));
      }
    }

    // Save immediately with status "processing" — return fast
    const mailItem = await saveMail({
      userId: req.user.id,
      imageUrl: imageUrls[0], // primary/thumbnail image
      imageUrls,              // all pages
      status: 'processing',
    });

    // Fire-and-forget: process in background
    processMailAsync(mailItem.id, req.user.id, imagePaths).catch((err) => {
      // SECURITY: Only log the message, not the full error (may contain extracted document content)
      console.error(`Background processing failed for mail ${mailItem.id}:`, err.message);
    });

    // Return immediately — client will poll for updates
    res.status(202).json(mailItem);
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload mail' });
  }
});

/**
 * Process a mail item in the background: run Gemini OCR+analysis, then update the DB record.
 */
async function processMailAsync(mailId, userId, imagePaths) {
  try {
    const analysis = await analyzeMail(imagePaths);

    // Try to find related/follow-up mail
    let threadId = mailId; // default: new thread = own ID
    try {
      const existing = await getAllMail(userId);
      const candidates = existing.filter((m) => m.id !== mailId && m.status !== 'processing');
      const matchedId = await findRelatedMail(analysis, candidates);
      if (matchedId) {
        const matched = candidates.find((m) => m.id === matchedId);
        if (matched) {
          threadId = matched.threadId || matched.id;
          console.log(`Mail ${mailId} linked to thread ${threadId} (matched with ${matchedId})`);
        }
      }
    } catch (matchErr) {
      console.error('Mail matching error (non-fatal):', matchErr.message);
    }

    // Auto-set reminder: 2 days before due date (if in the future)
    let reminderAt = null;
    if (analysis.dueDate) {
      try {
        const due = new Date(analysis.dueDate);
        const reminder = new Date(due.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days before
        if (reminder > new Date()) {
          reminderAt = reminder;
        } else if (due > new Date()) {
          // Due date is within 2 days — remind now
          reminderAt = new Date();
        }
      } catch { /* invalid date, skip */ }
    }

    await updateMail(mailId, userId, {
      extractedText: analysis.extractedText || '',
      summary: analysis.summary,
      sender: (analysis.sender && analysis.sender !== 'Unknown') ? analysis.sender : null,
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
      status: 'new', // processing complete → ready for user action
    });

    console.log(`Mail ${mailId} processed successfully`);
  } catch (err) {
    // Distinguish rejected documents from processing failures
    const isRejected = err.code === 'DOCUMENT_REJECTED';
    await updateMail(mailId, userId, {
      status: isRejected ? 'rejected' : 'error',
      extractedText: isRejected
        ? `Document rejected: ${err.message}`
        : `Processing failed: ${err.message}`,
    }).catch(() => {});

    throw err;
  }
}

// GET /api/mail — list all scanned mail
router.get('/', async (req, res) => {
  const items = await getAllMail(req.user.id);
  res.json(items);
});

// GET /api/mail/search — search and filter mail
router.get('/search', async (req, res) => {
  const { q, sender, receiver, category, status, dateFrom, dateTo } = req.query;
  const items = await searchMail(req.user.id, { q, sender, receiver, category, status, dateFrom, dateTo });
  res.json(items);
});

// GET /api/mail/contacts — directory of senders and receivers
router.get('/contacts', async (req, res) => {
  const contacts = await getContacts(req.user.id);
  res.json(contacts);
});

// GET /api/mail/contacts/:name — all mail for a specific contact
router.get('/contacts/:name', async (req, res) => {
  const items = await getMailByContact(req.user.id, decodeURIComponent(req.params.name));
  res.json(items);
});

// PATCH /api/mail/:id/edit — edit extracted fields (correction flow)
router.patch('/:id/edit', async (req, res) => {
  const editableFields = ['summary', 'sender', 'receiver', 'category', 'urgency', 'dueDate', 'amountDue', 'actionableInfo'];
  const updates = {};
  for (const field of editableFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  const updated = await updateMail(req.params.id, req.user.id, updates);
  if (!updated) return res.status(404).json({ error: 'Mail not found' });
  res.json(updated);
});

// POST /api/mail/:id/rescan — re-analyze a mail item using its original images
router.post('/:id/rescan', async (req, res) => {
  try {
    const item = await getMailById(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: 'Mail not found' });

    const imageUrls = item.imageUrls || (item.imageUrl ? [item.imageUrl] : []);
    if (imageUrls.length === 0) {
      return res.status(400).json({ error: 'No images available to rescan' });
    }

    // Convert URL paths to absolute file paths
    const imagePaths = imageUrls.map((url) =>
      path.join(__dirname, '..', url.startsWith('/') ? url.slice(1) : url)
    );

    // Check that files still exist on disk
    const missing = imagePaths.filter((p) => !fs.existsSync(p));
    if (missing.length === imagePaths.length) {
      return res.status(400).json({ error: 'Original image files no longer available' });
    }

    // Reset to processing state
    const updated = await updateMail(req.params.id, req.user.id, { status: 'processing' });
    res.json(updated);

    // Re-process in background
    const validPaths = imagePaths.filter((p) => fs.existsSync(p));
    processMailAsync(req.params.id, req.user.id, validPaths).catch((err) => {
      console.error(`Rescan failed for mail ${req.params.id}:`, err.message);
    });
  } catch (err) {
    console.error('Rescan error:', err.message);
    res.status(500).json({ error: 'Failed to rescan' });
  }
});

// PATCH /api/mail/:id/reminder — set or clear a reminder
router.patch('/:id/reminder', async (req, res) => {
  const { reminderAt } = req.body;
  const updated = await updateMail(req.params.id, req.user.id, {
    reminderAt: reminderAt ? new Date(reminderAt) : null,
    reminderSent: false,
  });
  if (!updated) return res.status(404).json({ error: 'Mail not found' });
  res.json(updated);
});

// GET /api/mail/reminders/due — get reminders that are due (for in-app notification polling)
router.get('/reminders/due', async (req, res) => {
  const dueReminders = await getDueReminders(req.user.id);
  res.json(dueReminders);
});

// GET /api/mail/:id — get single mail item (with related mail)
// Also allows read-only access if the item is shared with the requesting user
router.get('/:id', async (req, res) => {
  let item = await getMailById(req.params.id, req.user.id);
  let readOnly = false;
  let sharedByUser = null;

  if (!item) {
    // Not the owner — check sharing access
    const mail = await prisma.mail.findUnique({ where: { id: req.params.id } });
    if (!mail) return res.status(404).json({ error: 'Mail not found' });

    // Check explicit per-item share
    const explicitShare = await prisma.mailShare.findFirst({
      where: { mailId: req.params.id, sharedWithUserId: req.user.id },
      include: { mail: { select: { userId: true } } },
    });

    // Check category auto-share
    let hasAccess = !!explicitShare;
    if (!hasAccess) {
      const conn = await prisma.shareConnection.findFirst({
        where: { fromUserId: mail.userId, toUserId: req.user.id, status: 'accepted' },
      });
      const cats = conn?.sharedCategories;
      if (conn && Array.isArray(cats) && cats.includes(mail.category) && mail.source === 'scan') {
        hasAccess = true;
      }
    }

    if (!hasAccess) return res.status(404).json({ error: 'Mail not found' });

    // Load the sharedBy user info
    sharedByUser = await prisma.user.findUnique({
      where: { id: mail.userId },
      select: { id: true, name: true, email: true },
    });
    item = mail;
    readOnly = true;
  }

  const relatedMail = readOnly ? [] : await getRelatedMail(item.threadId, item.id, req.user.id);
  res.json({ ...item, relatedMail, readOnly, sharedBy: sharedByUser });
});

// PATCH /api/mail/:id/action — perform an action on mail
router.patch('/:id/action', async (req, res) => {
  const { action, note } = req.body;

  const validActions = ['archive', 'reply', 'pay_bill', 'schedule_followup', 'discard', 'mark_important'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
  }

  const updated = await updateMail(req.params.id, req.user.id, {
    status: action === 'discard' ? 'discarded' : 'action_taken',
    actionTaken: action,
    actionNote: note || null,
  });

  if (!updated) return res.status(404).json({ error: 'Mail not found' });
  res.json(updated);
});

// DELETE /api/mail/:id
router.delete('/:id', async (req, res) => {
  const item = await getMailById(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Mail not found' });

  // Clean up uploaded files from disk
  const filesToDelete = item.imageUrls || (item.imageUrl ? [item.imageUrl] : []);
  for (const relPath of filesToDelete) {
    try {
      const absPath = path.join(__dirname, '..', relPath);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch { /* best-effort cleanup */ }
  }

  await deleteMail(req.params.id, req.user.id);
  res.json({ success: true });
});

// ─── Voice Reminder ──────────────────────────────────────────────────────────

// In-memory storage — audio is processed and discarded, never written to disk
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /webm|ogg|mp4|m4a|wav|mpeg|mp3/;
    cb(null, allowed.test(file.mimetype) || allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

// POST /api/mail/voice — record a voice memo and convert it to a reminder
router.post('/voice', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const mimeType = req.file.mimetype || 'audio/webm';
    const analysis = await analyzeVoice(req.file.buffer, mimeType);

    const mailItem = await saveMail({
      userId: req.user.id,
      imageUrl: null,
      imageUrls: [],
      status: 'done',
      extractedText: analysis.transcription || '',
      summary: analysis.summary || 'Voice reminder',
      sender: 'Voice Memo',
      receiver: null,
      category: 'reminder',
      urgency: analysis.urgency || 'medium',
      dueDate: analysis.dueDate || null,
      amountDue: analysis.amountDue || null,
      suggestedActions: ['schedule_followup', 'archive'],
      keyDetails: analysis.keyDetails || [],
      actionableInfo: analysis.actionableInfo || [],
      paymentDetails: null,
      source: 'voice',
    });

    res.status(201).json(mailItem);
  } catch (err) {
    console.error('Voice analysis error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze voice memo' });
  }
});

export { router as mailRouter };
