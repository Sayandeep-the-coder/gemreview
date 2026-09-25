import * as core from '@actions/core';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

function run(): void {
  try {
    // ── Read all inputs ──────────────────────────────────────────────────────
    const geminiKey       = core.getInput('gemini-api-key',        { required: true });
    const githubToken     = core.getInput('github-token');
    const dimensions      = core.getInput('dimensions');
    const severityThresh  = core.getInput('severity-threshold');
    const maxComments     = core.getInput('max-inline-comments');
    const failOnSeverity  = core.getInput('fail-on-severity');
    const skipDraftPRs    = core.getInput('skip-draft-prs')  === 'true';
    const skipBots        = core.getInput('skip-bots')       === 'true';
    const postPrompt      = core.getInput('post-prompt')     === 'true';
    const dryRun          = core.getInput('dry-run')         === 'true';

    // ── Validate environment ─────────────────────────────────────────────────
    const repo    = process.env.GITHUB_REPOSITORY;
    const ref     = process.env.GITHUB_REF ?? '';
    const actor   = process.env.GITHUB_ACTOR ?? '';
    const isDraft = process.env.GITHUB_EVENT_PATH
      ? isDraftPR(process.env.GITHUB_EVENT_PATH)
      : false;

    if (!repo) {
      core.setFailed('GITHUB_REPOSITORY is not set. This action must run inside GitHub Actions.');
      return;
    }

    // Extract PR number from refs/pull/42/merge
    const prMatch = ref.match(/refs\/pull\/(\d+)\//);
    if (!prMatch) {
      core.info('No pull request ref detected (ref: ' + ref + '). Skipping review.');
      return;
    }
    const prNumber = prMatch[1];
    const prUrl    = `https://github.com/${repo}/pull/${prNumber}`;

    // ── Skip conditions ──────────────────────────────────────────────────────
    if (skipDraftPRs && isDraft) {
      core.info('⏭️  Skipping review — PR is in draft state.');
      return;
    }

    if (skipBots && actor.endsWith('[bot]')) {
      core.info(`⏭️  Skipping review — PR author is a bot (${actor}).`);
      return;
    }

    // ── Build CLI command ────────────────────────────────────────────────────
    // Resolve the CLI dist/index.js relative to the action root (two levels up from action/dist/)
    const cliPath = path.resolve(__dirname, '..', '..', 'dist', 'index.js');

    if (!fs.existsSync(cliPath)) {
      core.setFailed(
        `CLI entry point not found at ${cliPath}. ` +
        `Ensure the gemreview package is installed or the dist/ directory is present.`
      );
      return;
    }

    const args: string[] = [
      `node "${cliPath}" run`,
      `--pr "${prUrl}"`,
      `--dimensions "${dimensions}"`,
      `--severity "${severityThresh}"`,
      `--max-inline-comments "${maxComments}"`,
    ];

    if (failOnSeverity) args.push(`--fail-on-severity "${failOnSeverity}"`);
    if (postPrompt)     args.push('--prompt-comment');
    if (dryRun)         args.push('--dry-run');

    const command = args.join(' ');
    core.info(`🤖 Running: ${command}`);

    // ── Execute ──────────────────────────────────────────────────────────────
    const execOptions: ExecSyncOptionsWithStringEncoding = {
      stdio: 'inherit',
      encoding: 'utf8',
      env: {
        ...process.env,
        GEMREVIEW_GEMINI_KEY:   geminiKey,
        GEMREVIEW_GITHUB_TOKEN: githubToken,
        // Tell the CLI it's running in CI so it can adjust output
        GEMREVIEW_CI: 'true',
      },
    };

    try {
      execSync(command, execOptions);
    } catch (execError: unknown) {
      // Exit code 1 from CLI means findings hit fail-on-severity threshold
      // Exit code 2+ means an actual error
      const exitCode = (execError as NodeJS.ErrnoException & { status?: number }).status ?? 1;

      if (exitCode === 1 && failOnSeverity) {
        core.setFailed(
          `GemReview found findings at or above severity "${failOnSeverity}". ` +
          `Review the inline PR comments for details.`
        );
      } else {
        core.setFailed(`GemReview encountered an error (exit code ${exitCode}).`);
      }
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.setFailed(`GemReview Action failed unexpectedly: ${message}`);
  }
}

/**
 * Reads the GitHub event payload to check if the PR is in draft state.
 * Returns false if the event file can't be read.
 */
function isDraftPR(eventPath: string): boolean {
  try {
    const raw   = fs.readFileSync(eventPath, 'utf8');
    const event = JSON.parse(raw) as { pull_request?: { draft?: boolean } };
    return event?.pull_request?.draft === true;
  } catch {
    return false;
  }
}

run();
