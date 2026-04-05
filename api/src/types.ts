/**
 * Shared Hono context variable types.
 * Using `any` for model types to avoid circular import / module resolution issues.
 * The actual types are enforced at the middleware level.
 */
export type Variables = {
  user: any;
  authType: 'jwt' | 'apikey';
  rawApiKey: string;
  org: any;
  membership: any;
};
