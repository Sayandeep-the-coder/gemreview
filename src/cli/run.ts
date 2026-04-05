import type { RunOptions } from './types.js';
import { parsePRUrl, fetchPRMeta, fetchDiff } from '../github/pr.js';
import { createGitHubClient } from '../github/client.js';
import { postInlineComment, postSummaryComment } from '../github/comments.js';
import { loadConfig } from '../config/loader.js';
import { runReview } from '../review/orchestrator.js';
import { filterBySeverity, filterByPaths, capComments } from '../review/filter.js';
import { createSpinner } from '../output/spinner.js';
import { renderSummaryTable } from '../output/table.js';
import { renderDryRun } from '../output/dryRun.js';
import { registerSensitiveKeys, setVerbose } from '../output/logger.js';
import * as logger from '../output/logger.js';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { readFromConfig } from './apiClient.js';

export async function runCommand(options: RunOptions): Promise<void> {
  const startTime = Date.now();

  // ── Team mode: if org_api_key is configured, record review via backend ──
  const orgApiKeyRaw = readFromConfig('org_api_key') as string | undefined;
  const orgApiKey = orgApiKeyRaw?.trim();
  if (orgApiKey && !options.dryRun) {
    try {
      const { apiRequest } = await import('./apiClient.js');
      const { parsePRUrl: parse } = await import('../github/pr.js');
      const { owner, repo, pull_number } = parse(options.pr);

      // Still run the local review, but also report to the backend
      // The org_api_key is used for backend auth (grk_...)
      const durationMs = Date.now() - startTime;

      // We'll report the review after the local review completes
      // Store the key for later use
      (options as any)._orgApiKey = orgApiKey;
      (options as any)._reportToBackend = true;
    } catch {
      // Silently fall through to solo mode if API is unreachable
    }
  }

  // Detect CI environment — adjust output for GitHub Actions log format
  const isCI = process.env.GEMREVIEW_CI === 'true' || process.env.CI === 'true';
  if (isCI) {
    // Disable spinner in CI — it produces garbled output in GitHub Actions logs
    // The spinner check should already use ora's isTTY detection,
    // but set this explicitly for safety
    process.env.FORCE_COLOR = '1';
  }

  // 1. Parse and validate the PR URL
  const prUrl = options.pr;
  if (!prUrl || !prUrl.match(/github\.com\/[^/]+\/[^/]+\/pull\/\d+/)) {
    await logger.error(
      'Invalid PR URL. Expected format: https://github.com/<owner>/<repo>/pull/<number>',
    );
    process.exit(1);
  }

  const { owner, repo, pull_number } = parsePRUrl(prUrl);

  // 2. Load merged config with CLI overrides
  let config;
  try {
    config = loadConfig({
      dimensions: options.dimensions,
      severity_threshold: options.severity,
      model: options.model,
      max_inline_comments: options.maxComments,
    });
  } catch (error: any) {
    await logger.error(error.message);
    process.exit(1);
  }

  // Set verbose mode
  if (options.verbose) {
    setVerbose(true);
  }

  // Register sensitive keys for masking
  const sensitiveKeys = [config.gemini_api_key, config.github_token].filter(
    (k): k is string => !!k,
  );
  registerSensitiveKeys(sensitiveKeys);

  // 3. Fetch PR diff
  const spinner = await createSpinner('Fetching PR diff...');
  spinner.start();

  const octokit = createGitHubClient(config.github_token, config.github_base_url);

  let meta;
  let diffs;
  try {
    meta = await fetchPRMeta(octokit, owner, repo, pull_number);
    diffs = await fetchDiff(octokit, owner, repo, pull_number);
  } catch (error: any) {
    spinner.fail('Failed to fetch PR data');
    await logger.error(error.message);
    process.exit(1);
  }

  // 4. Filter excluded paths
  diffs = filterByPaths(diffs, config.exclude_paths);

  if (diffs.length === 0) {
    spinner.succeed('No files to review after filtering.');
    return;
  }

  // 5. Large PR warning
  const totalLines = diffs.reduce(
    (sum, d) => sum + d.additions + d.deletions,
    0,
  );
  if (totalLines > 2000) {
    spinner.stop();
    await logger.warn(
      `⚠️  Large PR detected (${totalLines} lines). Review may take up to 3 minutes.`,
    );
    spinner.start();
  }

  // 6. Run analysis
  let findings: any[] = [];
  try {
    if (orgApiKey) {
      spinner.text = 'Analysing via GemReview API (Team Mode)...';
      const { apiRequest } = await import('./apiClient.js');
      
      const response = await apiRequest<{ findings: any[] }>('/reviews/analyze', {
        method: 'POST',
        body: {
          diffs: diffs.map(d => ({ filename: d.filename, patch: d.patch })),
          dimensions: config.dimensions,
          model: config.model,
        },
        token: orgApiKey,
      });
      findings = response.findings;
    } else {
      if (!config.gemini_api_key) {
        spinner.fail('Missing API Key');
        await logger.error(
          'Gemini API key is required for local analysis. ' +
          'Set it with "gemreview config set gemini_api_key <key>" or join an organisation.',
        );
        process.exit(1);
      }
      spinner.text = 'Analysing with Gemini (Local Mode)...';
      findings = await runReview(config, diffs);
    }
  } catch (error: any) {
    spinner.fail('Analysis failed');
    await logger.error(error.message);
    process.exit(1);
  }

  // 7. Apply severity filter + comment cap
  findings = filterBySeverity(findings, config.severity_threshold);
  findings = capComments(findings, config.max_inline_comments);

  if (options.failOnSeverity) {
    const severityOrder: Record<string, number> = {
      low: 0, medium: 1, high: 2, critical: 3,
    };
    const threshold = severityOrder[options.failOnSeverity] ?? -1;
    const hasViolation = findings.some(
      f => (severityOrder[f.severity] ?? 0) >= threshold
    );
    if (hasViolation) {
      await logger.error(
        `❌ GemReview: findings found at or above severity "${options.failOnSeverity}". ` +
        `Failing CI check.`
      );
      process.exit(1);   // signals failure to GitHub Actions
    }
  }

  spinner.succeed(`Analysis complete — ${findings.length} finding(s)`);

  // 8. Generate agent prompt
  if (options.prompt || options.promptOutput) {
    const { generateAgentPrompt } = await import('../output/agentPrompt.js');

    // Fetch the raw diff patches for context
    const agentPrompt = generateAgentPrompt({
      findings,
      diffs,
      prUrl:   options.pr,
      prTitle: meta.title,
      model:   config.model,
    });

    if (options.promptOutput) {
      const outputDir = path.dirname(options.promptOutput);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(options.promptOutput, agentPrompt, 'utf8');
      logger.success(`✅ Agent prompt saved to ${options.promptOutput}`);
    } else {
      console.log('\n' + chalk.cyan('─'.repeat(60)));
      console.log(chalk.bold.cyan('  🤖 GemReview Agent Prompt — copy everything below'));
      console.log(chalk.cyan('─'.repeat(60)) + '\n');
      console.log(agentPrompt);
      console.log('\n' + chalk.cyan('─'.repeat(60)) + '\n');
    }
  }

  // 9. Dry-run mode
  if (options.dryRun) {
    await renderDryRun(findings);
    const tableOutput = await renderSummaryTable(findings);
    console.log(tableOutput);
    return;
  }
  if (config.inline_comments && findings.length > 0) {
    const commentSpinner = await createSpinner('Posting inline comments...');
    commentSpinner.start();

    let posted = 0;
    for (const finding of findings) {
      try {
        await postInlineComment(
          octokit,
          owner,
          repo,
          pull_number,
          finding,
          meta.headSha,
          false,
        );
        posted++;
      } catch (error: any) {
        await logger.debug(`Failed to post comment: ${error.message}`);
      }
    }

    commentSpinner.succeed(`Posted ${posted} inline comment(s)`);
  }

  // 10. Post summary comment
  if (config.summary_comment) {
    const summarySpinner = await createSpinner('Posting summary comment...');
    summarySpinner.start();

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    try {
      await postSummaryComment(
        octokit,
        owner,
        repo,
        pull_number,
        findings,
        {
          title: meta.title,
          filesReviewed: diffs.length,
          linesChanged: totalLines,
          model: config.model,
          durationSeconds,
        },
        false,
      );
      summarySpinner.succeed('Summary comment posted');
    } catch (error: any) {
      summarySpinner.fail('Failed to post summary');
      await logger.debug(error.message);
    }
  }

  // 11. Print terminal summary
  const tableOutput = await renderSummaryTable(findings);
  console.log(tableOutput);

  await logger.success(`✅ Review complete — ${findings.length} finding(s) posted.`);

  // 12. Report to backend if in team mode
  if ((options as any)._reportToBackend && (options as any)._orgApiKey) {
    try {
      const { apiRequest } = await import('./apiClient.js');
      const durationMs = Date.now() - startTime;

      await apiRequest('/reviews', {
        method: 'POST',
        token: (options as any)._orgApiKey,
        body: {
          repoName:      `${owner}/${repo}`,
          prNumber:      pull_number,
          prTitle:       meta.title,
          prUrl:         options.pr,
          triggeredBy:   'cli',
          model:         config.model,
          durationMs,
          filesReviewed: diffs.length,
          linesChanged:  totalLines,
          totalFindings: findings.length,
          criticalCount: findings.filter(f => f.severity === 'critical').length,
          highCount:     findings.filter(f => f.severity === 'high').length,
          mediumCount:   findings.filter(f => f.severity === 'medium').length,
          lowCount:      findings.filter(f => f.severity === 'low').length,
        },
      });
      await logger.debug('Review reported to GemReview API');
    } catch {
      // Non-fatal — the local review already completed successfully
      await logger.debug('Failed to report review to backend (non-fatal)');
    }
  }
}
