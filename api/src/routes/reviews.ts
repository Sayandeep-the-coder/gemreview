import { Hono } from 'hono';
import crypto from 'node:crypto';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember } from '../middleware/requireAdmin.js';
import { ApiKey } from '../models/ApiKey.js';
import { Organisation } from '../models/Organisation.js';
import { Review } from '../models/Review.js';
import { decryptKey } from '../services/encryption.js';
import { runServerReview } from '../services/ai.js';

export const reviewRoutes = new Hono<{ Variables: Variables }>();

/**
 * POST /reviews/analyze
 * Perform an AI code review using the organisation's Gemini key.
 * Used by members who don't have their own Gemini keys.
 */
reviewRoutes.post('/analyze', authMiddleware, async (c) => {
  const authType = c.get('authType');
  if (authType !== 'apikey') {
    return c.json({ error: 'This endpoint requires an org API key (grk_...)' }, 401);
  }

  const rawKey = c.get('rawApiKey');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const apiKey = await ApiKey.findOne({ keyHash });
  if (!apiKey) return c.json({ error: 'Invalid API key' }, 401);

  const org = await Organisation.findById(apiKey.orgId);
  if (!org) return c.json({ error: 'Organisation not found' }, 404);

  if (!org.geminiKeyEnc) {
    return c.json({ error: 'Organisation has no Gemini API key configured. Admin must set it first.' }, 400);
  }

  const body = await c.req.json<{
    diffs: Array<{ filename: string; patch: string }>;
    dimensions?: string[];
    model?: string;
  }>();

  if (!body.diffs || !Array.isArray(body.diffs)) {
    return c.json({ error: 'Missing or invalid diffs' }, 400);
  }

  try {
    const geminiKey = decryptKey(org.geminiKeyEnc);
    const modelName = body.model || 'gemini-1.5-pro';
    const dimensions = (body.dimensions || ['bugs', 'security', 'tests', 'optimisation']) as any[];

    const findings = await runServerReview(geminiKey, modelName, dimensions, body.diffs);

    // Track usage stats (optionally create a review record here as well)
    org.reviewsThisMonth += 1;
    org.totalReviewsAllTime += 1;
    org.lastReviewedAt = new Date();
    await org.save();

    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    return c.json({ findings }, 200);
  } catch (err: any) {
    console.error('[AI] Analysis failed:', err.message);
    return c.json({ error: err.message || 'AI Analysis failed' }, 500);
  }
});

/**
 * POST /reviews
 * Record a new review. Authenticated via org API key (grk_...).
 * No limit enforcement — all reviews go through.
 */
reviewRoutes.post('/', authMiddleware, async (c) => {
  const authType = c.get('authType');

  if (authType !== 'apikey') {
    return c.json({ error: 'This endpoint requires an org API key (grk_...)' }, 401);
  }

  const rawKey = c.get('rawApiKey');

  // Hash the incoming key
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Find the API key
  const apiKey = await ApiKey.findOne({ keyHash });
  if (!apiKey) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // Load the org
  const org = await Organisation.findById(apiKey.orgId);
  if (!org) {
    return c.json({ error: 'Organisation not found' }, 404);
  }

  const body = await c.req.json<{
    repoName:       string;
    prNumber:       number;
    prTitle?:       string;
    prUrl:          string;
    triggeredBy:    'cli' | 'action';
    model:          string;
    durationMs?:    number;
    filesReviewed?: number;
    linesChanged?:  number;
    totalFindings?: number;
    criticalCount?: number;
    highCount?:     number;
    mediumCount?:   number;
    lowCount?:      number;
  }>();

  if (!body.repoName || !body.prNumber || !body.prUrl || !body.triggeredBy || !body.model) {
    return c.json({ error: 'Missing required fields: repoName, prNumber, prUrl, triggeredBy, model' }, 400);
  }

  // Create review record
  const review = await Review.create({
    orgId:         org._id,
    apiKeyId:      apiKey._id,
    repoName:      body.repoName,
    prNumber:      body.prNumber,
    prTitle:       body.prTitle ?? '',
    prUrl:         body.prUrl,
    triggeredBy:   body.triggeredBy,
    modelName:     body.model,
    durationMs:    body.durationMs ?? 0,
    filesReviewed: body.filesReviewed ?? 0,
    linesChanged:  body.linesChanged ?? 0,
    totalFindings: body.totalFindings ?? 0,
    criticalCount: body.criticalCount ?? 0,
    highCount:     body.highCount ?? 0,
    mediumCount:   body.mediumCount ?? 0,
    lowCount:      body.lowCount ?? 0,
  });

  // Update org tracking counters (no enforcement)
  org.reviewsThisMonth    += 1;
  org.totalReviewsAllTime += 1;
  org.lastReviewedAt       = new Date();
  await org.save();

  // Update API key last used timestamp
  apiKey.lastUsedAt = new Date();
  await apiKey.save();

  return c.json({ review: { id: review._id } }, 201);
});

/**
 * GET /reviews/orgs/:slug/reviews
 * Paginated review history. Any org member.
 */
reviewRoutes.get('/orgs/:slug/reviews', authMiddleware, requireMember(), async (c) => {
  const org   = c.get('org');
  const repo  = c.req.query('repo');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const page  = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const skip  = (page - 1) * limit;

  const filter: Record<string, any> = { orgId: org._id };
  if (repo) {
    filter.repoName = repo;
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  return c.json({
    reviews,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});
