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

  // Verify the authenticated user owns a mail item referencing this file
  const uploadPath = `/uploads/${safe}`;
  const ownerMail = await prisma.mail.findFirst({
    where: {
      userId: req.user.id,
      OR: [
        { imageUrl: uploadPath },
        // imageUrls is a Json array — use string_contains to match within the JSON
        { imageUrls: { string_contains: uploadPath } },
      ],
    },
    select: { id: true },
  });

  if (!ownerMail) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.sendFile(filePath);
});

export { router as uploadsRouter };
