import { Hono } from 'hono';
import type { Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireMember } from '../middleware/requireAdmin.js';
import { OrgMember } from '../models/OrgMember.js';
import { User } from '../models/User.js';

export const memberRoutes = new Hono<{ Variables: Variables }>();

// All member routes require authentication
memberRoutes.use('*', authMiddleware);

/**
 * GET /members/orgs/:slug/members
 * List all members of an org. Any member can view.
 */
memberRoutes.get('/orgs/:slug/members', requireMember(), async (c) => {
  const org = c.get('org');

  const members = await OrgMember.find({ orgId: org._id });
  const userIds = members.map((m: any) => m.userId);
  const users   = await User.find({ _id: { $in: userIds } });

  const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

  const result = members.map((m: any) => {
    const user = userMap.get(m.userId.toString());
    return {
      userId:   m.userId,
      role:     m.role,
      joinedAt: m.joinedAt,
      user: user ? {
        name:        user.name,
        email:       user.email,
        avatarUrl:   user.avatarUrl,
        githubLogin: user.githubLogin,
      } : null,
    };
  });

  return c.json({ members: result });
});

/**
 * PATCH /members/orgs/:slug/members/:userId
 * Change a member's role. Admin only.
 */
memberRoutes.patch('/orgs/:slug/members/:userId', requireAdmin(), async (c) => {
  const org    = c.get('org');
  const user   = c.get('user');
  const userId = c.req.param('userId');
  const body   = await c.req.json<{ role: 'admin' | 'member' }>();

  if (!body.role || !['admin', 'member'].includes(body.role)) {
    return c.json({ error: 'Role must be "admin" or "member"' }, 400);
  }

  // Cannot change own role
  if (userId === user._id.toString()) {
    return c.json({ error: 'Cannot change your own role' }, 400);
  }

  const member = await OrgMember.findOne({ orgId: org._id, userId });
  if (!member) {
    return c.json({ error: 'Member not found' }, 404);
  }

  // If demoting admin → member, ensure at least 1 other admin remains
  if (member.role === 'admin' && body.role === 'member') {
    const adminCount = await OrgMember.countDocuments({ orgId: org._id, role: 'admin' });
    if (adminCount <= 1) {
      return c.json({ error: 'Cannot remove the last admin' }, 400);
    }
  }

  member.role = body.role;
  await member.save();

  return c.json({ member: { userId: member.userId, role: member.role } });
});

/**
 * DELETE /members/orgs/:slug/members/:target
 * Remove a member from the org. Target can be userId or @githubLogin. Admin only.
 */
memberRoutes.delete('/orgs/:slug/members/:target', requireAdmin(), async (c) => {
  const org    = c.get('org');
  const user   = c.get('user');
  const target = decodeURIComponent(c.req.param('target') || '');

  let userId: string | null = null;

  if (target.startsWith('@')) {
    // Look up user by GitHub login
    const foundUser = await User.findOne({ githubLogin: target.slice(1) });
    if (!foundUser) {
      return c.json({ error: `User with GitHub login "${target.slice(1)}" not found` }, 404);
    }
    userId = foundUser._id.toString();
  } else {
    userId = target || null;
  }

  // Cannot remove self
  if (userId === user._id.toString()) {
    return c.json({ error: 'Cannot remove yourself' }, 400);
  }

  const member = await OrgMember.findOne({ orgId: org._id, userId });
  if (!member) {
    return c.json({ error: 'Member not found in this organisation' }, 404);
  }

  // Cannot remove last admin
  if (member.role === 'admin') {
    const adminCount = await OrgMember.countDocuments({ orgId: org._id, role: 'admin' });
    if (adminCount <= 1) {
      return c.json({ error: 'Cannot remove the last admin' }, 400);
    }
  }

  await OrgMember.deleteOne({ _id: member._id });

  return c.json({ success: true, removed: target });
});
