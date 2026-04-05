import { Command } from 'commander';
import { runCommand } from './run.js';
import { initCommand } from './init.js';
import { configShowCommand, configSetCommand } from './config.js';
import { authLoginCommand, authLogoutCommand, authStatusCommand } from './auth.js';
import {
  orgCreateCommand, orgListCommand, orgUseCommand, orgSetGeminiKeyCommand,
  orgMembersListCommand, orgMembersInviteCommand, orgMembersRemoveCommand,
  orgKeysListCommand, orgKeysCreateCommand, orgKeysDeleteCommand,
  orgUsageCommand,
  orgInvitesShowCommand, orgInvitesAcceptCommand,
} from './org.js';
import type { Dimension, Severity } from '../gemini/parser.js';
import packageJson from '../../package.json';

// This constant is injected during the build process by tsup (see tsup.config.ts)
// For development (ts-node), we fall back to the version in package.json
declare const PKG_VERSION: string;
const version = typeof PKG_VERSION !== 'undefined' ? PKG_VERSION : packageJson.version;

const program = new Command();

program
  .name('gemreview')
  .description('AI-powered CLI PR review bot using Google Gemini')
  .version(version);

// gemreview init
program
  .command('init')
  .description('Interactive setup — configure API keys and preferences')
  .action(async () => {
    await initCommand();
  });

// gemreview run
program
  .command('run')
  .description('Run an AI-powered review on a GitHub PR')
  .requiredOption('--pr <url>', 'GitHub PR URL (e.g. https://github.com/org/repo/pull/42)')
  .option('--dry-run', 'Preview findings in terminal without posting to GitHub', false)
  .option('--verbose', 'Enable verbose debug output', false)
  .option(
    '--dimensions <dims>',
    'Comma-separated dimensions to review (bugs,security,tests,optimisation)',
    (val: string) => val.split(',') as Dimension[],
  )
  .option(
    '--severity <level>',
    'Minimum severity threshold (low, medium, high, critical)',
  )
  .option('--model <model>', 'Gemini model to use')
  .option(
    '--max-comments <n>',
    'Maximum number of inline comments to post',
    (val: string) => parseInt(val, 10),
  )
  .option(
    '--fail-on-severity <level>',
    'Exit with code 1 if any finding reaches this severity: low|medium|high|critical'
  )
  .option('--prompt', 'Generate an AI agent prompt to fix all findings (prints to stdout)')
  .option('--prompt-output <path>', 'Save the agent prompt to a file instead of printing')
  .action(async (opts) => {
    await runCommand({
      pr: opts.pr,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      dimensions: opts.dimensions,
      severity: opts.severity as Severity | undefined,
      model: opts.model,
      maxComments: opts.maxComments,
      prompt: opts.prompt || opts.promptOutput !== undefined,
      promptOutput: opts.promptOutput,
      failOnSeverity: opts.failOnSeverity,
    });
  });

// gemreview config
const configCmd = program
  .command('config')
  .description('View or update GemReview configuration');

configCmd
  .command('show')
  .description('Display current merged configuration')
  .action(async () => {
    await configShowCommand();
  });

configCmd
  .command('set <key> <value>')
  .description('Update a global config value')
  .action(async (key: string, value: string) => {
    await configSetCommand(key, value);
  });

// gemreview auth
const authCmd = program
  .command('auth')
  .description('Authenticate with GemReview API');

authCmd
  .command('login')
  .description('Login via GitHub OAuth — opens browser')
  .action(async () => { await authLoginCommand(); });

authCmd
  .command('logout')
  .description('Remove saved authentication token')
  .action(async () => { await authLogoutCommand(); });

authCmd
  .command('status')
  .description('Show current logged-in user and org memberships')
  .action(async () => { await authStatusCommand(); });

// gemreview org
const orgCmd = program
  .command('org')
  .description('Manage organisations and teams');

orgCmd
  .command('create <name>')
  .description('Create a new organisation')
  .action(async (name: string) => { await orgCreateCommand(name); });

orgCmd
  .command('list')
  .description('List your organisations')
  .action(async () => { await orgListCommand(); });

orgCmd
  .command('use <slug>')
  .description('Set the active organisation')
  .action(async (slug: string) => { await orgUseCommand(slug); });

orgCmd
  .command('set-gemini-key <key>')
  .description('Provision organisation with a Google Gemini API key')
  .action(async (key: string) => { await orgSetGeminiKeyCommand(key); });

orgCmd
  .command('usage')
  .description('Show usage stats for the active organisation')
  .action(async () => { await orgUsageCommand(); });

// gemreview org members
const membersCmd = orgCmd
  .command('members')
  .description('Manage organisation members');

membersCmd
  .command('list')
  .description('List members of the active organisation')
  .action(async () => { await orgMembersListCommand(); });

membersCmd
  .command('invite <target>')
  .description('Invite by email or @githubLogin')
  .action(async (target: string) => { await orgMembersInviteCommand(target); });

membersCmd
  .command('remove <userId>')
  .description('Remove a member (admin only)')
  .action(async (userId: string) => { await orgMembersRemoveCommand(userId); });

// gemreview org keys
const keysCmd = orgCmd
  .command('keys')
  .description('Manage org API keys (admin only)');

keysCmd
  .command('list')
  .description('List API keys')
  .action(async () => { await orgKeysListCommand(); });

keysCmd
  .command('create <name>')
  .description('Create a new API key')
  .action(async (name: string) => { await orgKeysCreateCommand(name); });

keysCmd
  .command('delete <keyId>')
  .description('Delete an API key')
  .action(async (keyId: string) => { await orgKeysDeleteCommand(keyId); });

// gemreview org invites
const invitesCmd = orgCmd
  .command('invites')
  .description('Manage organisation invitations');

invitesCmd
  .command('show <token>')
  .description('View invitation details')
  .action(async (token: string) => { await orgInvitesShowCommand(token); });

invitesCmd
  .command('accept <token>')
  .description('Accept an invitation')
  .action(async (token: string) => { await orgInvitesAcceptCommand(token); });

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
