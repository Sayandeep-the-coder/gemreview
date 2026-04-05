import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { OrgMember } from '../models/OrgMember.js';
import { Organisation } from '../models/Organisation.js';
import { exchangeGithubCode, getGithubUser } from '../services/github.js';
import { signJWT, verifyJWT } from '../services/jwt.js';

export const authRoutes = new Hono<{ Variables: Variables }>();

/**
 * GET /auth/config
 * Public endpoint to fetch GitHub Client ID for OAuth initiation.
 */
authRoutes.get('/config', (c) => {
  return c.json({
    clientId: process.env.GITHUB_CLIENT_ID || '',
  });
});

/**
 * GET /auth/github/cli
 * Initiation point for CLI-based OAuth.
 */
authRoutes.get('/github/cli', (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const APP_URL = process.env.APP_URL;

  const redirectUri = encodeURIComponent(`${APP_URL}/auth/github/callback`);
  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=cli`;

  return c.redirect(oauthUrl);
});

/**
 * GET /auth/github/web
 * Initiation point for browser-based OAuth (for invitations).
 */
authRoutes.get('/github/web', (c) => {
  const inviteToken = c.req.query('inviteToken');
  const clientId = process.env.GITHUB_CLIENT_ID;
  const APP_URL = process.env.APP_URL;

  const redirectUri = encodeURIComponent(`${APP_URL}/auth/github/callback`);
  // Carry inviteToken in 'state'
  const state = inviteToken ? `invite:${inviteToken}` : 'web';

  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`;

  return c.redirect(oauthUrl);
});

/**
 * GET /auth/github/callback (Unified Redirector)
 * Callback handler for both CLI and Web OAuth flows.
 */
authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state') || '';

  if (!code) return c.html('<h1>Error: No code received from GitHub</h1>', 400);

  // 1. Branch: CLI flow
  if (state === 'cli') {
    // Redirect the browser to the CLI's local server (no server-side exchange needed)
    return c.redirect(`http://localhost:9876/callback?code=${code}`);
  }

  // 2. Branch: Web flow (Invitation or Web Login)
  try {
    // Exchange code for token
    const accessToken = await exchangeGithubCode(code);
    const ghUser = await getGithubUser(accessToken);

    // Upsert user
    const user = await User.findOneAndUpdate(
      { githubId: String(ghUser.id) },
      {
        githubId:    String(ghUser.id),
        githubLogin: ghUser.login,
        email:       ghUser.email,
        name:        ghUser.name,
        avatarUrl:   ghUser.avatar_url,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let joinedOrg = null;

    // Process invitation if present in state
    if (state.startsWith('invite:')) {
      const inviteToken = state.split(':')[1];
      const { Invite } = await import('../models/Invite.js');
      const { Organisation } = await import('../models/Organisation.js');

      const invite = await Invite.findOne({ token: inviteToken, status: 'pending' });
      if (invite) {
        // Add to org
        await OrgMember.findOneAndUpdate(
          { orgId: invite.orgId, userId: user._id },
          { orgId: invite.orgId, userId: user._id, role: invite.role },
          { upsert: true }
        );

        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        await invite.save();

        const org = await Organisation.findById(invite.orgId);
        if (org) joinedOrg = org.name;
      }
    }

    return c.html(SUCCESS_PAGE_HTML({
      name: user.name || user.githubLogin,
      joinedOrg,
    }));
  } catch (err: any) {
    return c.html(`<h1>Authentication failed: ${err.message}</h1>`, 500);
  }
});

/**
 * POST /auth/github
 * Exchange a GitHub OAuth code for a GemReview JWT.
 */
authRoutes.post('/github', async (c) => {
  const body = await c.req.json<{ code: string }>();

  if (!body.code) {
    return c.json({ error: 'Missing OAuth code' }, 400);
  }

  try {
    // 1. Exchange code for GitHub access token
    const accessToken = await exchangeGithubCode(body.code);

    // 2. Fetch GitHub user profile
    const ghUser = await getGithubUser(accessToken);

    // 3. Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { githubId: String(ghUser.id) },
      {
        githubId:    String(ghUser.id),
        githubLogin: ghUser.login,
        email:       ghUser.email,
        name:        ghUser.name,
        avatarUrl:   ghUser.avatar_url,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4. Sign JWT
    const token = signJWT({ userId: user._id.toString(), email: user.email });

    // 5. Check for any pending GitHub-type invites for this user
    const { Invite } = await import('../models/Invite.js');
    const pendingInvites = await Invite.find({
      type: 'github',
      githubLogin: ghUser.login,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    for (const invite of pendingInvites) {
      // Auto-add to org
      await OrgMember.findOneAndUpdate(
        { orgId: invite.orgId, userId: user._id },
        { orgId: invite.orgId, userId: user._id, role: invite.role },
        { upsert: true, new: true }
      );
      invite.status = 'accepted';
      invite.acceptedAt = new Date();
      await invite.save();
    }

    return c.json({
      token,
      user: {
        id:          user._id,
        githubLogin: user.githubLogin,
        email:       user.email,
        name:        user.name,
        avatarUrl:   user.avatarUrl,
      },
    });
  } catch (error: any) {
    console.error('[auth] GitHub OAuth error:', error.message);
    return c.json({ error: error.message ?? 'Authentication failed' }, 401);
  }
});

/**
 * POST /auth/refresh
 * Issue a new JWT with fresh expiry.
 */
authRoutes.post('/refresh', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = signJWT({ userId: user._id.toString(), email: user.email });
  return c.json({ token });
});

/**
 * GET /auth/me
 * Return current user profile and org memberships.
 */
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');

  // Get all org memberships
  const memberships = await OrgMember.find({ userId: user._id });
  const orgIds = memberships.map((m: any) => m.orgId);
  const orgs   = await Organisation.find({ _id: { $in: orgIds } });

  const orgMap = new Map(orgs.map((o: any) => [o._id.toString(), o]));

  const membershipList = memberships.map((m: any) => ({
    org: {
      id:   orgMap.get(m.orgId.toString())?._id,
      name: orgMap.get(m.orgId.toString())?.name,
      slug: orgMap.get(m.orgId.toString())?.slug,
    },
    role: m.role,
  }));

  return c.json({
    user: {
      id:          user._id,
      githubLogin: user.githubLogin,
      email:       user.email,
      name:        user.name,
      avatarUrl:   user.avatarUrl,
    },
    memberships: membershipList,
  });
});

/**
 * Premium Success Page HTML Template
 */
function SUCCESS_PAGE_HTML(data: { name: string; joinedOrg: string | null }) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Success — GemReview</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #09090b;
          --primary: #3b82f6;
          --text: #fafafa;
          --text-muted: #a1a1aa;
          --border: #27272a;
        }
        body {
          margin: 0;
          font-family: 'Inter', sans-serif;
          background-color: var(--bg);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          background-color: #18181b;
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 48px;
          text-align: center;
          max-width: 400px;
        }
        .check {
          width: 64px;
          height: 64px;
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        h1 { font-size: 24px; margin: 0 0 12px 0; }
        p { color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; }
        .highlight { color: var(--text); font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1>Successfully Joined!</h1>
        <p>
          Welcome, <span class="highlight">${data.name}</span>.<br>
          ${data.joinedOrg ? html`You are now a member of <span class="highlight">${data.joinedOrg}</span>.` : ''}
        </p>
        <p style="font-size: 14px;">
          You can now close this window and use the GemReview CLI to start reviewing code.
        </p>
      </div>
    </body>
    </html>
  `;
}
