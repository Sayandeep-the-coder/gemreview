import type { Context, Next } from 'hono';
import type { Variables } from '../types.js';
import { OrgMember } from '../models/OrgMember.js';
import { Organisation } from '../models/Organisation.js';

/**
 * Require the authenticated user to be an **admin** of the org
 * identified by the `:slug` route param.
 *
 * Sets `org` on the context.
 */
export function requireAdmin(slugParam = 'slug') {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const user = c.get('user');
    const slug = c.req.param(slugParam);

    const org = await Organisation.findOne({ slug });
    if (!org) return c.json({ error: 'Organisation not found' }, 404);

    const membership = await OrgMember.findOne({
      orgId:  org._id,
      userId: user._id,
      role:   'admin',
    });

    if (!membership) return c.json({ error: 'Forbidden' }, 403);

    c.set('org', org);
    return next();
  };
}

/**
 * Require the authenticated user to be a **member** (any role) of the org
 * identified by the `:slug` route param.
 *
 * Sets `org` and `membership` on the context.
 */
export function requireMember(slugParam = 'slug') {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const user = c.get('user');
    const slug = c.req.param(slugParam);

    const org = await Organisation.findOne({ slug });
    if (!org) return c.json({ error: 'Organisation not found' }, 404);

    const membership = await OrgMember.findOne({
      orgId:  org._id,
      userId: user._id,
    });

    if (!membership) return c.json({ error: 'Forbidden' }, 403);

    c.set('org', org);
    c.set('membership', membership);
    return next();
  };
}
