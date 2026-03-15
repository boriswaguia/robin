import express from 'express';
import prisma from '../services/db.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── Users ────────────────────────────────────────────────────────────────────

// GET /api/admin/users — list & filter users
// Query params: search, role, hasGmail, sortBy, order, page, limit
router.get('/users', async (req, res) => {
  try {
    const {
      search,
      role,
      hasGmail,
      sortBy = 'createdAt',
      order = 'desc',
      page = '1',
      limit = '25',
    } = req.query;

    const where = {};

    // Free-text search on name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Role filter
    if (role && ['user', 'admin'].includes(role)) {
      where.role = role;
    }

    // Gmail connection filter
    if (hasGmail === 'true') {
      where.gmailRefreshToken = { not: null };
    } else if (hasGmail === 'false') {
      where.gmailRefreshToken = null;
    }

    // Sorting — only allow safe columns
    const allowedSort = ['createdAt', 'name', 'email', 'role'];
    const orderBy = allowedSort.includes(sortBy)
      ? { [sortBy]: order === 'asc' ? 'asc' : 'desc' }
      : { createdAt: 'desc' };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          gmailEmail: true,
          consentedAt: true,
          consentVersion: true,
          createdAt: true,
          _count: {
            select: {
              mail: true,
              pushSubscriptions: true,
              sharingFrom: true,
              sharingTo: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('Admin list users error:', err.message);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /api/admin/users/:id — detailed user view
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        gmailEmail: true,
        consentedAt: true,
        consentVersion: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            mail: true,
            pushSubscriptions: true,
            sharingFrom: true,
            sharingTo: true,
            gmailSyncs: true,
            activityLogs: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get recent activity for this user (last 20)
    const recentActivity = await prisma.activityLog.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, action: true, count: true, metadata: true, createdAt: true },
    });

    // Get item breakdown by category
    const mailByCategory = await prisma.mail.groupBy({
      by: ['category'],
      where: { userId: req.params.id },
      _count: true,
    });

    // Get item breakdown by status
    const mailByStatus = await prisma.mail.groupBy({
      by: ['status'],
      where: { userId: req.params.id },
      _count: true,
    });

    res.json({ user, recentActivity, mailByCategory, mailByStatus });
  } catch (err) {
    console.error('Admin get user error:', err.message);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// PATCH /api/admin/users/:id — update user role
router.patch('/users/:id', async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "user" or "admin"' });
    }

    // Prevent demoting yourself
    if (req.params.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    console.error('Admin update user error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── Activity Logs ────────────────────────────────────────────────────────────

// GET /api/admin/activity — list & filter activity logs
// Query params: userId, action, from, to, sortBy, order, page, limit
router.get('/activity', async (req, res) => {
  try {
    const {
      userId,
      action,
      from,
      to,
      sortBy = 'createdAt',
      order = 'desc',
      page = '1',
      limit = '50',
    } = req.query;

    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    // Date range filter
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const allowedSort = ['createdAt', 'action'];
    const orderBy = allowedSort.includes(sortBy)
      ? { [sortBy]: order === 'asc' ? 'asc' : 'desc' }
      : { createdAt: 'desc' };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          count: true,
          metadata: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('Admin list activity error:', err.message);
    res.status(500).json({ error: 'Failed to list activity logs' });
  }
});

// GET /api/admin/stats — dashboard summary stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      gmailUsers,
      totalMail,
      totalActivity,
      recentSignups,
      activityByAction,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { gmailRefreshToken: { not: null } } }),
      prisma.mail.count(),
      prisma.activityLog.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.activityLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: { _count: { action: 'desc' } },
      }),
    ]);

    res.json({
      totalUsers,
      gmailUsers,
      totalMail,
      totalActivity,
      recentSignups,
      activityByAction: activityByAction.map((a) => ({ action: a.action, count: a._count })),
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export { router as adminRouter };
