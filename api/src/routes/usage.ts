import { Hono } from 'hono';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember } from '../middleware/requireAdmin.js';
import { OrgMember } from '../models/OrgMember.js';
import { ApiKey } from '../models/ApiKey.js';

export const usageRoutes = new Hono<{ Variables: Variables }>();

// All usage routes require authentication
usageRoutes.use('*', authMiddleware);

/**
 * GET /usage/
 * Health check for usage routes.
 */
usageRoutes.get('/', (c) => c.json({ status: 'ok', message: 'Usage routes are active' }));

/**
 * GET /usage/orgs/:slug/usage
 * Return usage statistics for the org. Any member can view.
 */
usageRoutes.get('/orgs/:slug/usage', requireMember(), async (c) => {
  const org = c.get('org');

  const [memberCount, apiKeyCount] = await Promise.all([
    OrgMember.countDocuments({ orgId: org._id }),
    ApiKey.countDocuments({ orgId: org._id }),
  ]);

  return c.json({
    reviewsThisMonth:    org.reviewsThisMonth,
    totalReviewsAllTime: org.totalReviewsAllTime,
    lastReviewedAt:      org.lastReviewedAt,
    memberCount,
    apiKeyCount,
  });
});
