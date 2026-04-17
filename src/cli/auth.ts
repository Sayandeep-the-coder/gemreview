import * as http from 'node:http';
import { API_BASE_URL } from './apiClient.js';
import { apiRequest, saveToConfig, removeFromConfig, readFromConfig } from './apiClient.js';

/**
 * gemreview auth login
 * Opens the browser to GitHub OAuth, receives the callback on a local server,
 * exchanges the code for a JWT, and saves it to config.
 */
export async function authLoginCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const { execSync } = await import('node:child_process');

  const CALLBACK_PORT = 9876;
  const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

  // Read GitHub client ID from env or fetch from backend
  let clientId = process.env.GITHUB_CLIENT_ID ?? '';
  if (!clientId) {
    try {
      const data = await apiRequest<{ clientId: string }>('/auth/config');
      clientId = data.clientId;
    } catch {
      // Ignore if fetch fails — check if it's still missing below
    }
  }

  if (!clientId) {
    console.error(chalk.red('Error: GITHUB_CLIENT_ID env var is not set and could not be fetched from API.'));
    console.error(chalk.gray('Set it via: export GITHUB_CLIENT_ID=your_client_id'));
    process.exit(1);
  }

  // Initiate OAuth via the GemReview API redirector
  // This ensures the correct redirect_uri is used (matching the GitHub App settings)
  const oauthUrl = `${API_BASE_URL}/auth/github/cli`;

  console.log(chalk.bold('\n  🔐 GemReview Auth Login\n'));
  console.log(chalk.gray('  Opening browser for GitHub authentication...'));
  console.log(chalk.gray(`  If the browser doesn't open, visit:\n  ${oauthUrl}\n`));

  // Open browser (cross-platform)
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      execSync(`start "" "${oauthUrl}"`, { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execSync(`open "${oauthUrl}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${oauthUrl}"`, { stdio: 'ignore' });
    }
  } catch {
    console.log(chalk.yellow('  Could not open browser automatically.'));
  }

  // Start local server to receive OAuth callback
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '', `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>❌ No code received</h2><p>Please try again.</p></body></html>');
          server.close();
          resolve();
          return;
        }

        try {
          // Exchange code for JWT via the GemReview API
          const data = await apiRequest<{
            token: string;
            user: { githubLogin: string; email: string; name: string };
          }>('/auth/github', {
            method: 'POST',
            body: { code },
          });

          // Save JWT to config
          saveToConfig('gemreview_token', data.token);
          saveToConfig('api_url', API_BASE_URL);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>GemReview — Authenticated</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                  :root {
                    --bg: #09090b;
                    --text: #fafafa;
                    --text-muted: #a1a1aa;
                    --border: #27272a;
                  }
                  body {
                    margin: 0;
                    font-family: 'Inter', sans-serif;
                    background: radial-gradient(circle at center, #1f1f2e 0%, var(--bg) 100%);
                    color: var(--text);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    overflow: hidden;
                  }
                  .card {
                    background: rgba(24, 24, 27, 0.6);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 48px;
                    text-align: center;
                    max-width: 420px;
                    width: 100%;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    opacity: 0;
                    transform: translateY(20px);
                  }
                  @keyframes floatIn {
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .icon-wrapper {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05));
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    color: #4ade80;
                    animation: pulse 2s infinite ease-in-out;
                  }
                  @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                  }
                  h2 { 
                    font-size: 28px; 
                    margin: 0 0 12px 0; 
                    background: linear-gradient(to right, #fff, #a1a1aa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                  }
                  p { color: var(--text-muted); line-height: 1.6; margin-bottom: 32px; font-size: 16px; }
                  .highlight { color: var(--text); font-weight: 600; }
                  .btn {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border);
                    color: var(--text);
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: default;
                    transition: all 0.2s ease;
                  }
                  .btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="icon-wrapper">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <h2>Authenticated!</h2>
                  <p>Welcome, <span class="highlight">${data.user.name || data.user.githubLogin}</span>.</p>
                  <div class="btn">You can close this window now</div>
                </div>
              </body>
              </html>
          `);

          console.log(chalk.green(`\n  ✅ Logged in as ${data.user.githubLogin} (${data.user.email})`));
          console.log(chalk.gray('  Token saved to ~/.gemreview/config.json\n'));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h2>❌ Authentication failed</h2><p>${err.message}</p></body></html>`);
          console.error(chalk.red(`\n  Error: ${err.message}`));
        }

        server.close();
        resolve();
      }
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(chalk.gray(`  Waiting for OAuth callback on port ${CALLBACK_PORT}...`));
    });

    // Auto-close after 2 minutes
    setTimeout(() => {
      server.close();
      console.log(chalk.yellow('\n  Timed out waiting for OAuth callback.'));
      resolve();
    }, 120_000);
  });
}

/**
 * gemreview auth logout
 * Removes the GemReview JWT from config.
 */
export async function authLogoutCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;

  removeFromConfig('gemreview_token');
  removeFromConfig('active_org');

  console.log(chalk.green('  ✅ Logged out. Token removed from config.'));
}

/**
 * gemreview auth status
 * Shows the currently logged-in user and their org memberships.
 */
export async function authStatusCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;

  const token = readFromConfig('gemreview_token') as string | undefined;
  if (!token) {
    console.log(chalk.yellow('  Not logged in. Run "gemreview auth login" to authenticate.'));
    return;
  }

  try {
    const data = await apiRequest<{
      user: { githubLogin: string; email: string; name: string };
      memberships: Array<{ org: { name: string; slug: string }; role: string }>;
    }>('/auth/me');

    console.log(chalk.bold('\n  👤 Current User\n'));
    console.log(`  Name:   ${data.user.name || data.user.githubLogin}`);
    console.log(`  Email:  ${data.user.email}`);
    console.log(`  GitHub: @${data.user.githubLogin}`);

    const activeOrg = readFromConfig('active_org') as string | undefined;

    if (data.memberships.length > 0) {
      console.log(chalk.bold('\n  🏢 Organisations\n'));
      for (const m of data.memberships) {
        const active = m.org.slug === activeOrg ? chalk.green(' ← active') : '';
        console.log(`  ${m.org.name} (${m.org.slug}) — ${m.role}${active}`);
      }
    } else {
      console.log(chalk.gray('\n  No organisation memberships yet.'));
      console.log(chalk.gray('  Create one with "gemreview org create <name>"\n'));
    }

    console.log('');
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
    console.error(chalk.gray('  Your token may have expired. Run "gemreview auth login" again.'));
  }
}
