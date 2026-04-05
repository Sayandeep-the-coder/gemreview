import { Hono } from 'hono';
import { html } from 'hono/html';
import crypto from 'node:crypto';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireMember } from '../middleware/requireAdmin.js';
import { Invite } from '../models/Invite.js';
import { OrgMember } from '../models/OrgMember.js';
import { User } from '../models/User.js';
import { Organisation } from '../models/Organisation.js';
import { getGithubUserByLogin } from '../services/github.js';
import { sendInviteEmail } from '../services/email.js';

export const inviteRoutes = new Hono<{ Variables: Variables }>();

/**
 * POST /invites/orgs/:slug/invites
 * Create an invite (email or GitHub username). Admin only.
 */
inviteRoutes.post('/orgs/:slug/invites', authMiddleware, requireAdmin(), async (c) => {
  const org  = c.get('org');
  const user = c.get('user');
  const body = await c.req.json<{
    type: 'email' | 'github';
    email?: string;
    githubLogin?: string;
    role: 'admin' | 'member';
  }>();

  if (!body.type || !['email', 'github'].includes(body.type)) {
    return c.json({ error: 'Type must be "email" or "github"' }, 400);
  }

  const role = body.role || 'member';

  // ── EMAIL INVITE ──
  if (body.type === 'email') {
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return c.json({ error: 'Valid email is required' }, 400);
    }

    // Check if already a member
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      const existingMember = await OrgMember.findOne({
        orgId:  org._id,
        userId: existingUser._id,
      });
      if (existingMember) {
        return c.json({ error: 'User is already a member of this organisation' }, 400);
      }
    }

    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await Invite.create({
      orgId:     org._id,
      invitedBy: user._id,
      type:      'email',
      email:     body.email,
      role,
      token,
      expiresAt,
    });

    // Send the invite email
    try {
      await sendInviteEmail({
        toEmail:     body.email,
        orgName:     org.name,
        inviterName: user.name || user.githubLogin,
        role,
        inviteToken: token,
      });
    } catch (err: any) {
      console.error('[invites] Failed to send email:', err.message);
      // Don't fail the invite creation — the invite exists, email just didn't send
    }

    return c.json({
      invite: {
        id:        invite._id,
        email:     invite.email,
        role:      invite.role,
        status:    invite.status,
        expiresAt: invite.expiresAt,
      },
    }, 201);
  }

  // ── GITHUB USERNAME INVITE ──
  if (body.type === 'github') {
    if (!body.githubLogin) {
      return c.json({ error: 'GitHub login is required' }, 400);
    }

    // Look up the GitHub user
    const ghUser = await getGithubUserByLogin(body.githubLogin);
    if (!ghUser) {
      return c.json({ error: 'GitHub user not found' }, 404);
    }

    // Check if this GitHub user already has a GemReview account
    const existingUser = await User.findOne({ githubId: String(ghUser.id) });

    if (existingUser) {
      // Check if already a member
      const existingMember = await OrgMember.findOne({
        orgId:  org._id,
        userId: existingUser._id,
      });
      if (existingMember) {
        return c.json({ error: 'User is already a member of this organisation' }, 400);
      }

      // Add directly — no invite needed
      await OrgMember.create({
        orgId:  org._id,
        userId: existingUser._id,
        role,
      });

      return c.json({ added: true }, 201);
    }

    // User doesn't have a GemReview account yet — create a pending invite
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const invite = await Invite.create({
      orgId:       org._id,
      invitedBy:   user._id,
      type:        'github',
      githubLogin: body.githubLogin,
      role,
      token:       crypto.randomUUID(),
      expiresAt,
    });

    return c.json({
      added: false,
      invite: {
        id:          invite._id,
        githubLogin: invite.githubLogin,
        role:        invite.role,
        status:      invite.status,
      },
    }, 201);
  }

  return c.json({ error: 'Invalid invite type' }, 400);
});

/**
 * GET /invites/orgs/:slug/invites
 * List all invites for an org. Admin only.
 */
inviteRoutes.get('/orgs/:slug/invites', authMiddleware, requireAdmin(), async (c) => {
  const org = c.get('org');

  const invites = await Invite.find({ orgId: org._id })
    .sort({ createdAt: -1 })
    .populate('invitedBy', 'name githubLogin');

  const result = invites.map((inv: any) => ({
    id:          inv._id,
    type:        inv.type,
    email:       inv.email,
    githubLogin: inv.githubLogin,
    role:        inv.role,
    status:      inv.status,
    expiresAt:   inv.expiresAt,
    invitedBy:   inv.invitedBy,
    createdAt:   inv.createdAt,
  }));

  return c.json({ invites: result });
});

/**
 * DELETE /invites/orgs/:slug/invites/:inviteId
 * Cancel an invite. Admin only.
 */
inviteRoutes.delete('/orgs/:slug/invites/:inviteId', authMiddleware, requireAdmin(), async (c) => {
  const org      = c.get('org');
  const inviteId = c.req.param('inviteId');

  const invite = await Invite.findOne({ _id: inviteId, orgId: org._id });
  if (!invite) return c.json({ error: 'Invite not found' }, 404);

  invite.status = 'expired';
  await invite.save();

  return c.json({ success: true });
});

/**
 * GET /invites/:token (PUBLIC — no auth required)
 * View invite details before accepting.
 */
inviteRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');

  const invite = await Invite.findOne({ token })
    .populate('invitedBy', 'name githubLogin')
    .populate('orgId', 'name slug');

  if (!invite) return c.json({ error: 'Invite not found' }, 404);

  if (invite.status === 'accepted') {
    return c.json({ error: 'Invite already accepted' }, 410);
  }

  if (invite.status === 'expired' || invite.expiresAt < new Date()) {
    return c.json({ error: 'Invite has expired' }, 410);
  }

  const org = invite.orgId as any; // populated

  // ── Browser/HTML Response ──
  const accept = c.req.header('Accept');
  if (accept && accept.includes('text/html')) {
    const inviter = invite.invitedBy as any;
    const APP_URL = process.env.APP_URL || '';

    return c.html(INVITE_PAGE_HTML({
      orgName:   org.name,
      orgSlug:   org.slug,
      role:      invite.role,
      invitedBy: inviter.name || inviter.githubLogin,
      ghLogin:   inviter.githubLogin,
      inviteUrl: `${APP_URL}/auth/github/web?inviteToken=${token}`,
    }));
  }

  // ── JSON Response ──
  return c.json({
    orgName:   org.name,
    orgSlug:   org.slug,
    role:      invite.role,
    expiresAt: invite.expiresAt,
    invitedBy: invite.invitedBy,
  });
});

/**
 * Premium Invitation Landing Page HTML Template
 */
function INVITE_PAGE_HTML(data: {
  orgName: string;
  orgSlug: string;
  role: string;
  invitedBy: string;
  ghLogin: string;
  inviteUrl: string;
}) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Join ${data.orgName} — GemReview</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #09090b;
          --card: #18181b;
          --primary: #3b82f6;
          --primary-hover: #2563eb;
          --text: #fafafa;
          --text-muted: #a1a1aa;
          --border: #27272a;
        }

        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: 'Inter', system-ui, sans-serif;
          background-color: var(--bg);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          background-image: 
            radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
            radial-gradient(at 50% 0%, hsla(225,39%,30%,0.15) 0, transparent 50%),
            radial-gradient(at 100% 0%, hsla(339,49%,30%,0.05) 0, transparent 50%);
        }

        .container {
          width: 100%;
          max-width: 440px;
          padding: 24px;
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .card {
          background-color: rgba(24, 24, 27, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }

        .logo {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.05em;
          margin-bottom: 40px;
          background: linear-gradient(to right, #3b82f6, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .avatar-group {
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
        }

        .avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid var(--primary);
          padding: 2px;
          background: var(--bg);
        }

        h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 15px;
          line-height: 1.5;
          margin-bottom: 32px;
        }

        .highlight { color: var(--text); font-weight: 600; }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          background-color: var(--text);
          color: var(--bg);
          text-decoration: none;
          padding: 14px 20px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255,255,255,0.1);
          opacity: 0.9;
        }

        .btn svg {
          width: 20px;
          height: 20px;
        }

        .footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-muted);
        }

        .badge {
          display: inline-block;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.1);
          color: var(--primary);
          border-radius: 99px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">GemReview</div>
          
          <div class="avatar-group">
            <img src="https://github.com/${data.ghLogin}.png" class="avatar" alt="${data.invitedBy}">
          </div>

          <h1>You've been invited</h1>
          <p class="subtitle">
            <span class="highlight">${data.invitedBy}</span> has invited you to join <br>
            <span class="highlight">${data.orgName}</span> as a <span class="badge">${data.role}</span>
          </p>

          <a href="${data.inviteUrl}" class="btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            Accept Invitation with GitHub
          </a>

          <div class="footer">
            GemReview 🤖 — AI-powered PR reviews.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * POST /invites/:token/accept
 * Accept an invite. Requires authentication.
 */
inviteRoutes.post('/:token/accept', authMiddleware, async (c) => {
  const token = c.req.param('token');
  const user  = c.get('user');

  const invite = await Invite.findOne({ token });
  if (!invite) return c.json({ error: 'Invite not found' }, 404);

  if (invite.status === 'accepted') {
    return c.json({ error: 'Invite already accepted' }, 410);
  }

  if (invite.status === 'expired' || invite.expiresAt < new Date()) {
    return c.json({ error: 'Invite has expired' }, 410);
  }

  // For email invites, verify the user's email matches
  if (invite.type === 'email' && invite.email) {
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return c.json({ error: 'This invite was sent to a different email address' }, 403);
    }
  }

  // Add user to org
  await OrgMember.findOneAndUpdate(
    { orgId: invite.orgId, userId: user._id },
    { orgId: invite.orgId, userId: user._id, role: invite.role },
    { upsert: true, new: true }
  );

  // Mark invite as accepted
  invite.status = 'accepted';
  invite.acceptedAt = new Date();
  await invite.save();

  const org = await Organisation.findById(invite.orgId);

  return c.json({
    org: org ? { id: org._id, name: org.name, slug: org.slug } : null,
    role: invite.role,
  });
});
