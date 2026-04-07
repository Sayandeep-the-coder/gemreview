import { apiRequest, saveToConfig, readFromConfig } from './apiClient.js';

/**
 * gemreview org create <name>
 */
export async function orgCreateCommand(name: string): Promise<void> {
  const chalk = (await import('chalk')).default;

  try {
    const data = await apiRequest<{ org: { name: string; slug: string } }>('/orgs', {
      method: 'POST',
      body: { name },
    });

    // Auto-set as active org
    saveToConfig('active_org', data.org.slug);

    console.log(chalk.green(`\n  ✅ Created organisation "${data.org.name}" (${data.org.slug})`));
    console.log(chalk.gray(`  Set as active org. You're the admin.\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org list
 */
export async function orgListCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;

  try {
    const data = await apiRequest<{
      memberships: Array<{ org: { name: string; slug: string }; role: string }>;
    }>('/auth/me');

    const activeOrg = readFromConfig('active_org') as string | undefined;

    if (data.memberships.length === 0) {
      console.log(chalk.yellow('\n  No organisations yet. Create one with "gemreview org create <name>"\n'));
      return;
    }

    console.log(chalk.bold('\n  🏢 Your Organisations\n'));
    for (const m of data.memberships) {
      const active = m.org.slug === activeOrg ? chalk.green(' ← active') : '';
      console.log(`  ${m.org.name} (${m.org.slug}) — ${m.role}${active}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org use <slug>
 */
export async function orgUseCommand(slug: string): Promise<void> {
  const chalk = (await import('chalk')).default;

  try {
    // Verify membership
    const data = await apiRequest<{
      org: { name: string; slug: string };
    }>(`/orgs/${encodeURIComponent(slug)}`);

    saveToConfig('active_org', data.org.slug);
    console.log(chalk.green(`\n  ✅ Active org set to "${data.org.name}" (${data.org.slug})\n`));
    console.log(chalk.green(`\n  ✅ Active org set to "${data.org.name}" (${data.org.slug})\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org set-gemini-key <key>
 */
export async function orgSetGeminiKeyCommand(key: string): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    await apiRequest(`/orgs/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: { geminiKey: key },
    });

    console.log(chalk.green(`\n  ✅ Gemini API key updated for "${slug}"`));
    console.log(chalk.gray(`  Members can now run reviews using the organisation's credit.\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org members list
 */
export async function orgMembersListCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    const data = await apiRequest<{
      members: Array<{
        userId: string;
        role: string;
        joinedAt: string;
        user: { name: string; email: string; githubLogin: string } | null;
      }>;
    }>(`/members/orgs/${encodeURIComponent(slug)}/members`);

    console.log(chalk.bold(`\n  👥 Members of ${slug}\n`));
    for (const m of data.members) {
      const name = m.user?.name || m.user?.githubLogin || 'Unknown';
      const role = m.role === 'admin' ? chalk.yellow('admin') : chalk.gray('member');
      console.log(`  ${name} (@${m.user?.githubLogin ?? '?'}) — ${role}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org members invite <email|@githubLogin>
 */
export async function orgMembersInviteCommand(target: string): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    // Determine if it's a GitHub username (starts with @) or email
    const isGithub = target.startsWith('@');
    const body = isGithub
      ? { type: 'github' as const, githubLogin: target.slice(1), role: 'member' as const }
      : { type: 'email' as const, email: target, role: 'member' as const };

    const data = await apiRequest<{
      added?: boolean;
      invite?: { email?: string; githubLogin?: string; status: string };
    }>(`/invites/orgs/${encodeURIComponent(slug)}/invites`, {
      method: 'POST',
      body,
    });

    if (data.added) {
      console.log(chalk.green(`\n  ✅ @${target.slice(1)} added directly to ${slug}\n`));
    } else if (data.invite) {
      const ident = data.invite.email || data.invite.githubLogin || target;
      console.log(chalk.green(`\n  ✅ Invite sent to ${ident} (${data.invite.status})\n`));
    }
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org members remove <target>
 * Target can be userId or @githubLogin
 */
export async function orgMembersRemoveCommand(target: string): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    await apiRequest(`/members/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(target)}`, {
      method: 'DELETE',
    });
    console.log(chalk.green(`\n  ✅ Member "${target}" removed from ${slug}\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org keys list
 */
export async function orgKeysListCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    const data = await apiRequest<{
      apiKeys: Array<{
        id: string;
        name: string;
        keyPreview: string;
        lastUsedAt: string | null;
        createdAt: string;
        createdBy: string;
      }>;
    }>(`/api-keys/orgs/${encodeURIComponent(slug)}/api-keys`);

    if (data.apiKeys.length === 0) {
      console.log(chalk.yellow(`\n  No API keys yet. Create one with "gemreview org keys create <name>"\n`));
      return;
    }

    console.log(chalk.bold(`\n  🔑 API Keys for ${slug}\n`));
    for (const k of data.apiKeys) {
      const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'never';
      console.log(`  ${k.name} (${k.keyPreview}) — last used: ${lastUsed}  [id: ${k.id}]`);
    }
    console.log('');
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org keys create <name>
 */
export async function orgKeysCreateCommand(name: string): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    const data = await apiRequest<{
      key: string;
      preview: string;
      warning: string;
    }>(`/api-keys/orgs/${encodeURIComponent(slug)}/api-keys`, {
      method: 'POST',
      body: { name },
    });

    console.log(chalk.green(`\n  ✅ API key created: "${name}"`));
    console.log(chalk.bold(`\n  Key: ${data.key}\n`));
    console.log(chalk.yellow(`  ⚠️  ${data.warning}`));
    console.log(chalk.gray('\n  To use this key with the CLI, run:'));
    console.log(chalk.gray(`  gemreview config set org_api_key ${data.key}\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org keys delete <keyId>
 */
export async function orgKeysDeleteCommand(keyId: string): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    await apiRequest(`/api-keys/orgs/${encodeURIComponent(slug)}/api-keys/${keyId}`, {
      method: 'DELETE',
    });
    console.log(chalk.green(`\n  ✅ API key deleted\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org usage
 */
export async function orgUsageCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const slug = getActiveOrg();
  if (!slug) return;

  try {
    const data = await apiRequest<{
      reviewsThisMonth: number;
      totalReviewsAllTime: number;
      lastReviewedAt: string | null;
      memberCount: number;
      apiKeyCount: number;
    }>(`/usage/orgs/${encodeURIComponent(slug)}/usage`);

    console.log(chalk.bold(`\n  📊 Usage for ${slug}\n`));
    console.log(`  Reviews this month:  ${data.reviewsThisMonth}`);
    console.log(`  Total all-time:      ${data.totalReviewsAllTime}`);
    console.log(`  Last reviewed:       ${data.lastReviewedAt ? new Date(data.lastReviewedAt).toLocaleString() : 'never'}`);
    console.log(`  Members:             ${data.memberCount}`);
    console.log(`  API keys:            ${data.apiKeyCount}`);
    console.log(chalk.green('\n  💎 Free plan — unlimited reviews\n'));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org invites show <token>
 */
export async function orgInvitesShowCommand(token: string): Promise<void> {
  const chalk = (await import('chalk')).default;

  try {
    const data = await apiRequest<{
      orgName: string;
      orgSlug: string;
      role: string;
      expiresAt: string;
      invitedBy: { name: string; githubLogin: string };
    }>(`/invites/${encodeURIComponent(token)}`);

    console.log(chalk.bold('\n  📩 Invitation Details\n'));
    console.log(`  Organisation: ${data.orgName} (${data.orgSlug})`);
    console.log(`  Invited By:   ${data.invitedBy.name || data.invitedBy.githubLogin} (@${data.invitedBy.githubLogin})`);
    console.log(`  Role:         ${data.role}`);
    console.log(`  Expires:      ${new Date(data.expiresAt).toLocaleString()}`);
    console.log(chalk.gray('\n  To accept this invitation, run:'));
    console.log(chalk.gray(`  gemreview org invites accept ${token}\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

/**
 * gemreview org invites accept <token>
 */
export async function orgInvitesAcceptCommand(token: string): Promise<void> {
  const chalk = (await import('chalk')).default;

  try {
    const data = await apiRequest<{
      org: { name: string; slug: string };
      role: string;
    }>(`/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    });

    saveToConfig('active_org', data.org.slug);

    console.log(chalk.green(`\n  ✅ Invitation accepted!`));
    console.log(`  You are now a ${data.role} of "${data.org.name}" (${data.org.slug}).`);
    console.log(chalk.gray(`  Set as active org.\n`));
  } catch (err: any) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
}

// ── Helper ──

function getActiveOrg(): string | null {
  const slug = readFromConfig('active_org') as string | undefined;
  if (!slug) {
    console.error('  No active org. Set one with "gemreview org use <slug>"');
    return null;
  }
  return slug;
}
