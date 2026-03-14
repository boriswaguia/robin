import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import prisma from '../services/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const router = express.Router();

// All upload access requires authentication
router.use(authenticate);

/**
 * GET /uploads/:filename
 * Serves an uploaded file only if the authenticated user owns a mail item that references it.
 */
router.get('/:filename', async (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Verify the authenticated user owns (or has shared access to) a mail item referencing this file
  const uploadPath = `/uploads/${safe}`;
  const ownerMail = await prisma.mail.findFirst({
    where: {
      OR: [
        { imageUrl: uploadPath },
        { imageUrls: { string_contains: uploadPath } },
      ],
    },
    select: { id: true, userId: true, category: true, source: true },
  });

  if (!ownerMail) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Owner can always access
  if (ownerMail.userId === req.user.id) {
    return res.sendFile(filePath);
  }

  // Check sharing access: explicit per-item share
  const explicitShare = await prisma.mailShare.findFirst({
    where: { mailId: ownerMail.id, sharedWithUserId: req.user.id },
  });
  if (explicitShare) {
    return res.sendFile(filePath);
  }

  // Check sharing access: category auto-share
  const conn = await prisma.shareConnection.findFirst({
    where: { fromUserId: ownerMail.userId, toUserId: req.user.id, status: 'accepted' },
  });
  const cats = conn?.sharedCategories;
  if (conn && Array.isArray(cats) && cats.includes(ownerMail.category) && ownerMail.source === 'scan') {
    return res.sendFile(filePath);
  }

  return res.status(403).json({ error: 'Access denied' });
});

export { router as uploadsRouter };
