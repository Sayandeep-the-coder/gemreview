import { Hono } from 'hono';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireMember } from '../middleware/requireAdmin.js';
import { Organisation } from '../models/Organisation.js';
import { OrgMember } from '../models/OrgMember.js';
import { ApiKey } from '../models/ApiKey.js';
import { Review } from '../models/Review.js';
import { Invite } from '../models/Invite.js';
import { encryptKey } from '../services/encryption.js';
import { testGeminiKey } from '../services/gemini.js';

export const orgRoutes = new Hono<{ Variables: Variables }>();

// All org routes require authentication
orgRoutes.use('*', authMiddleware);

/**
 * Generate a URL-safe slug from an org name.
 * Appends a random suffix to ensure uniqueness.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

/**
 * POST /orgs
 * Create a new organisation. The creator becomes admin.
 */
orgRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ name: string }>();

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: 'Organisation name is required' }, 400);
  }

  // Generate unique slug
  let slug = generateSlug(body.name);

  // Ensure uniqueness (extremely unlikely collision with random suffix, but safe)
  let existing = await Organisation.findOne({ slug });
  while (existing) {
    slug = generateSlug(body.name);
    existing = await Organisation.findOne({ slug });
  }

  const org = await Organisation.create({
    name: body.name.trim(),
    slug,
  });

  // Make the creator an admin
  await OrgMember.create({
    orgId:  org._id,
    userId: user._id,
    role:   'admin',
  });

  return c.json({ org }, 201);
});

/**
 * GET /orgs/:slug
 * Get org details. Requires membership.
 */
orgRoutes.get('/:slug', requireMember(), async (c) => {
  const org = c.get('org');

  const memberCount = await OrgMember.countDocuments({ orgId: org._id });
  const apiKeyCount = await ApiKey.countDocuments({ orgId: org._id });

  return c.json({
    org: {
      id:                  org._id,
      name:                org.name,
      slug:                org.slug,
      reviewsThisMonth:    org.reviewsThisMonth,
      totalReviewsAllTime: org.totalReviewsAllTime,
      lastReviewedAt:      org.lastReviewedAt,
      hasGeminiKey:        org.geminiKeyEnc.length > 0,
      createdAt:           org.createdAt,
    },
    memberCount,
    apiKeyCount,
  });
});

/**
 * PATCH /orgs/:slug
 * Update org details. Admin only.
 */
orgRoutes.patch('/:slug', requireAdmin(), async (c) => {
  const org  = c.get('org');
  const body = await c.req.json<{ name?: string; geminiKey?: string }>();

  if (body.name !== undefined) {
    org.name = body.name.trim();
  }

  if (body.geminiKey !== undefined) {
    // Validate the key before storing
    const valid = await testGeminiKey(body.geminiKey);
    if (!valid) {
      return c.json({ error: 'Invalid Gemini API key' }, 400);
    }
    org.geminiKeyEnc = encryptKey(body.geminiKey);
  }

  await org.save();

  return c.json({
    org: {
      id:           org._id,
      name:         org.name,
      slug:         org.slug,
      hasGeminiKey: org.geminiKeyEnc.length > 0,
      updatedAt:    org.updatedAt,
    },
  });
});

/**
 * DELETE /orgs/:slug
 * Delete org and all associated data. Admin only.
 */
orgRoutes.delete('/:slug', requireAdmin(), async (c) => {
  const org = c.get('org');

  // Cascade delete all associated data
  await Promise.all([
    OrgMember.deleteMany({ orgId: org._id }),
    ApiKey.deleteMany({ orgId: org._id }),
    Review.deleteMany({ orgId: org._id }),
    Invite.deleteMany({ orgId: org._id }),
    Organisation.deleteOne({ _id: org._id }),
  ]);

  return c.json({ success: true });
});
