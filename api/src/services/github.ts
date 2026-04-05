/**
 * GitHub OAuth and user lookup services
 */

/** Exchange an OAuth authorization code for an access token */
export async function exchangeGithubCode(code: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id:     process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };

  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'GitHub OAuth failed');
  }

  return data.access_token;
}

/** Fetch GitHub user profile + primary verified email */
export async function getGithubUser(accessToken: string) {
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
    }),
  ]);

  if (!userRes.ok) {
    throw new Error(`GitHub user fetch failed: ${userRes.status}`);
  }

  const user   = await userRes.json() as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };

  const emails = await emailsRes.json() as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  const primary = emails.find(e => e.primary && e.verified);

  return {
    id:         user.id,
    login:      user.login,
    name:       user.name ?? '',
    avatar_url: user.avatar_url,
    email:      primary?.email ?? '',
  };
}

/** Look up a GitHub user by their username (for direct-add invites) */
export async function getGithubUserByLogin(login: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
    headers,
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub user lookup failed: ${res.status}`);

  return res.json() as Promise<{
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  }>;
}
