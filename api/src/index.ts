import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { connectDB } from './db.js';
import { authRoutes }   from './routes/auth.js';
import { orgRoutes }    from './routes/orgs.js';
import { memberRoutes } from './routes/members.js';
import { apiKeyRoutes } from './routes/apiKeys.js';
import { inviteRoutes } from './routes/invites.js';
import { reviewRoutes } from './routes/reviews.js';
import { usageRoutes }  from './routes/usage.js';

// Connect to MongoDB before starting the server
await connectDB();

const app = new Hono();

// ── Global Middleware ──
app.use('*', logger());
app.use('*', cors({
  origin:      process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
}));

// ── Health Check ──
app.get('/health', (c) => c.json({ status: 'ok', version: '1.3.1' }));

// ── Routes ──
app.route('/auth',     authRoutes);
app.route('/orgs',     orgRoutes);
app.route('/members',  memberRoutes);
app.route('/api-keys', apiKeyRoutes);
app.route('/invites',  inviteRoutes);
app.route('/reviews',  reviewRoutes);
app.route('/usage',    usageRoutes);

// ── 404 Handler ──
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ── Error Handler ──
app.onError((err, c) => {
  console.error('[error]', err);
  if (err.message === 'UNAUTHORIZED') return c.json({ error: 'Unauthorized' }, 401);
  if (err.message === 'FORBIDDEN')    return c.json({ error: 'Forbidden' }, 403);
  return c.json({ error: 'Internal server error' }, 500);
});

// ── Monthly Reset ──
// Check daily if we've crossed into a new month, then reset counters
const ONE_DAY = 24 * 60 * 60 * 1000;
let lastResetMonth = new Date().getMonth();

setInterval(async () => {
  const now = new Date();
  if (now.getMonth() !== lastResetMonth && now.getDate() === 1) {
    try {
      const { Organisation } = await import('./models/Organisation.js');
      await Organisation.updateMany({}, { $set: { reviewsThisMonth: 0 } });
      lastResetMonth = now.getMonth();
      console.log('[reset] Monthly review counter reset');
    } catch (err) {
      console.error('[reset] Failed to reset monthly counters:', err);
    }
  }
}, ONE_DAY);

console.log('[reset] Monthly counter reset check enabled (daily)');

// ── Keep-Alive (Render free tier) ──
if (process.env.NODE_ENV === 'production') {
  const SELF_URL = process.env.APP_URL ?? '';
  if (SELF_URL) {
    setInterval(async () => {
      try {
        await fetch(`${SELF_URL}/health`);
        console.log('[keep-alive] pinged /health');
      } catch {
        // ignore — just keeping the service warm
      }
    }, 14 * 60 * 1000); // every 14 minutes
  }
}

// ── Start Server ──
const port = parseInt(process.env.PORT ?? '3001', 10);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`\n  🚀 GemReview API v1.3.1 running on http://localhost:${info.port}\n`);
});
