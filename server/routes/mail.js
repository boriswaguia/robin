import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import { analyzeMail, findRelatedMail } from '../services/ai.js';
import { getAllMail, getMailById, saveMail, updateMail, deleteMail, getRelatedMail, searchMail, getContacts, getMailByContact } from '../services/storage.js';
import { authenticate } from '../middleware/auth.js';

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

// POST /api/mail/scan — upload & queue async processing
router.post('/scan', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const imagePath = req.file.path;

    // Save immediately with status "processing" — return fast
    const mailItem = await saveMail({
      userId: req.user.id,
      imageUrl,
      status: 'processing',
    });

    // Fire-and-forget: process in background
    processMailAsync(mailItem.id, req.user.id, imagePath).catch((err) => {
      console.error(`Background processing failed for mail ${mailItem.id}:`, err);
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
async function processMailAsync(mailId, userId, imagePath) {
  try {
    const analysis = await analyzeMail(imagePath);

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

    await updateMail(mailId, userId, {
      extractedText: analysis.extractedText || '',
      summary: analysis.summary,
      sender: analysis.sender,
      receiver: analysis.receiver || 'Unknown',
      category: analysis.category,
      urgency: analysis.urgency,
      dueDate: analysis.dueDate || null,
      amountDue: analysis.amountDue || null,
      suggestedActions: analysis.suggestedActions || [],
      keyDetails: analysis.keyDetails || [],
      actionableInfo: analysis.actionableInfo || [],
      threadId,
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

// GET /api/mail/:id — get single mail item (with related mail)
router.get('/:id', async (req, res) => {
  const item = await getMailById(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Mail not found' });

  const relatedMail = await getRelatedMail(item.threadId, item.id, req.user.id);
  res.json({ ...item, relatedMail });
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
  const result = await deleteMail(req.params.id, req.user.id);
  if (!result) return res.status(404).json({ error: 'Mail not found' });
  res.json({ success: true });
});

export { router as mailRouter };
