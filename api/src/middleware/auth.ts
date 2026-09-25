import type { Context, Next } from 'hono';
import type { Variables } from '../types.js';
import { verifyJWT } from '../services/jwt.js';
import { User } from '../models/User.js';

/**
 * Auth middleware — supports both JWT (user) and org API key (grk_...) auth.
 *
 * Sets on context:
 *   - authType: 'jwt' | 'apikey'
 *   - user: IUser (jwt only)
 *   - rawApiKey: string (apikey only)
 */
export async function authMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = header.slice(7).trim();
  console.log(`[Auth] Incoming token starts with: ${token.slice(0, 10)}... (length: ${token.length})`);

  // Org API keys start with "grk_" — handled by the reviews route
  if (token.startsWith('grk_')) {
    c.set('authType', 'apikey');
    c.set('rawApiKey', token);
    return next();
  }

  // Otherwise treat as a JWT
  try {
    const payload = verifyJWT(token);
    const user    = await User.findById(payload.userId);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    c.set('user', user);
    c.set('authType', 'jwt');
    return next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}
