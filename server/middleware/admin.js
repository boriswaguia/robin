import prisma from '../services/db.js';

/**
 * Log a user action. Never stores PII or content — only the action type
 * and optional numeric/structural metadata.
 *
 * @param {string} userId - User who performed the action
 * @param {string} action - Action identifier, e.g. 'mail.scan', 'gmail.sync'
 * @param {object} [opts] - Optional extra data
 * @param {number} [opts.count] - Number of items affected
 * @param {object} [opts.metadata] - Structured data (no PII)
 */
export async function logActivity(userId, action, { count, metadata } = {}) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, count, metadata },
    });
  } catch (err) {
    // Activity logging should never break the main flow
    console.error('Activity log write failed:', err.message);
  }
}

/**
 * Express middleware that restricts access to admin users.
 * Must be used AFTER authenticate().
 */
export async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
