import { Hono } from 'hono';
import crypto from 'node:crypto';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { ApiKey } from '../models/ApiKey.js';
import { User } from '../models/User.js';

export const apiKeyRoutes = new Hono<{ Variables: Variables }>();

// All api-key routes require authentication
apiKeyRoutes.use('*', authMiddleware);

/**
 * GET /api-keys/orgs/:slug/api-keys
 * List all API keys for an org. Admin only.
 * Never returns keyHash or raw key.
 */
apiKeyRoutes.get('/orgs/:slug/api-keys', requireAdmin(), async (c) => {
  const org = c.get('org');

  const keys = await ApiKey.find({ orgId: org._id }).sort({ createdAt: -1 });
  const creatorIds = [...new Set(keys.map((k: any) => k.createdById.toString()))];
  const creators   = await User.find({ _id: { $in: creatorIds } });
  const creatorMap = new Map(creators.map((u: any) => [u._id.toString(), u]));

  const result = keys.map((k: any) => ({
    id:         k._id,
    name:       k.name,
    keyPreview: k.keyPreview,
    lastUsedAt: k.lastUsedAt,
    createdAt:  k.createdAt,
    createdBy:  creatorMap.get(k.createdById.toString())?.githubLogin ?? 'unknown',
  }));

  return c.json({ apiKeys: result });
});

/**
 * POST /api-keys/orgs/:slug/api-keys
 * Create a new org API key. Admin only.
 * Returns the raw key ONCE — never retrievable again.
 */
apiKeyRoutes.post('/orgs/:slug/api-keys', requireAdmin(), async (c) => {
  const org  = c.get('org');
  const user = c.get('user');
  const body = await c.req.json<{ name: string }>();

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: 'Key name is required' }, 400);
  }

  // Generate raw key: grk_ + 32 random hex bytes
  const rawKey = 'grk_' + crypto.randomBytes(32).toString('hex');

  // Hash with SHA-256 for storage
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Preview: last 6 characters
  const keyPreview = '...' + rawKey.slice(-6);

  const apiKey = await ApiKey.create({
    orgId:       org._id,
    name:        body.name.trim(),
    keyHash,
    keyPreview,
    createdById: user._id,
  });

  return c.json({
    key:     rawKey,
    preview: keyPreview,
    id:      apiKey._id,
    name:    apiKey.name,
    warning: 'Save this key now — it will not be shown again',
  }, 201);
});

/**
 * PATCH /api-keys/orgs/:slug/api-keys/:keyId
 * Rename an API key. Admin only.
 */
apiKeyRoutes.patch('/orgs/:slug/api-keys/:keyId', requireAdmin(), async (c) => {
  const org   = c.get('org');
  const keyId = c.req.param('keyId');
  const body  = await c.req.json<{ name: string }>();

  if (!body.name || body.name.trim().length === 0) {
    return c.json({ error: 'Key name is required' }, 400);
  }

  const apiKey = await ApiKey.findOne({ _id: keyId, orgId: org._id });
  if (!apiKey) return c.json({ error: 'API key not found' }, 404);

  apiKey.name = body.name.trim();
  await apiKey.save();

  return c.json({
    apiKey: {
      id:         apiKey._id,
      name:       apiKey.name,
      keyPreview: apiKey.keyPreview,
    },
  });
});

/**
 * DELETE /api-keys/orgs/:slug/api-keys/:keyId
 * Delete an API key. Admin only.
 * Cannot delete the last key.
 */
apiKeyRoutes.delete('/orgs/:slug/api-keys/:keyId', requireAdmin(), async (c) => {
  const org   = c.get('org');
  const keyId = c.req.param('keyId');

  const apiKey = await ApiKey.findOne({ _id: keyId, orgId: org._id });
  if (!apiKey) return c.json({ error: 'API key not found' }, 404);

  // Cannot delete the last key
  const keyCount = await ApiKey.countDocuments({ orgId: org._id });
  if (keyCount <= 1) {
    return c.json({ error: 'Cannot delete the last API key' }, 400);
  }

  await ApiKey.deleteOne({ _id: apiKey._id });

  return c.json({ success: true });
});
