import type { Octokit } from '@octokit/rest';
import type { Finding } from '../gemini/parser.js';
import type { PRMeta } from './pr.js';
import * as logger from '../output/logger.js';

const DIMENSION_EMOJIS: Record<string, string> = {
  bugs: '🐛',
  security: '🔒',
  tests: '🧪',
  optimisation: '⚡',
};

function formatCommentBody(finding: Finding): string {
  const emoji = DIMENSION_EMOJIS[finding.dimension] || '❓';
  const lines: string[] = [
    `**[GemReview 🤖] ${emoji} ${finding.dimension.toUpperCase()} | ${finding.severity.toUpperCase()}**`,
    '',
    `**${finding.title}**`,
    '',
    finding.description,
    '',
  ];

  if (finding.suggestion) {
    lines.push(`💡 **Suggested fix:** ${finding.suggestion}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `*Confidence: ${Math.round(finding.confidence * 100)}% · GemReview v1.0.0*`,
  );

  return lines.join('\n');
}

async function handleRateLimit(
  response: { headers: Record<string, string | undefined> },
): Promise<void> {
  const remaining = response.headers['x-ratelimit-remaining'];
  const resetHeader = response.headers['x-ratelimit-reset'];

  if (remaining === '0' && resetHeader) {
    const resetTime = parseInt(resetHeader, 10) * 1000;
    const now = Date.now();
    const waitMs = Math.max(resetTime - now, 0);
    if (waitMs > 0) {
      await logger.warn(
        `GitHub rate limit reached. Waiting ${Math.ceil(waitMs / 1000)}s for reset...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export async function postInlineComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number,
  finding: Finding,
  headSha: string,
  dryRun: boolean = false,
): Promise<void> {
  // Dry-run safety guard
  if (dryRun) {
    throw new Error('postInlineComment called during dry-run mode. This is a bug.');
  }

  const body = formatCommentBody(finding);

  try {
    const response = await octokit.pulls.createReviewComment({
      owner,
      repo,
      pull_number,
      body,
      commit_id: headSha,
      path: finding.file,
      line: finding.line,
      side: 'RIGHT',
    });

    await handleRateLimit(response as any);
  } catch (err: any) {
    // Handle rate limit on 403
    if (err.status === 403 && err.response?.headers) {
      await handleRateLimit(err.response);
      // Retry once
      await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number,
        body,
        commit_id: headSha,
        path: finding.file,
        line: finding.line,
        side: 'RIGHT',
      });
    } else {
      await logger.warn(
        `Failed to post inline comment on ${finding.file}:${finding.line}: ${err.message}`,
      );
    }
  }
}

export async function postSummaryComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number,
  findings: Finding[],
  meta: { title: string; filesReviewed: number; linesChanged: number; model: string; durationSeconds: number },
  dryRun: boolean = false,
): Promise<void> {
  // Dry-run safety guard
  if (dryRun) {
    throw new Error('postSummaryComment called during dry-run mode. This is a bug.');
  }

  const dimensions = ['bugs', 'security', 'tests', 'optimisation'] as const;
  const dimLabels: Record<string, string> = {
    bugs: '🐛 Code Quality',
    security: '🔒 Security',
    tests: '🧪 Test Coverage',
    optimisation: '⚡ Optimisation',
  };

  const tableRows: string[] = [];
  for (const dim of dimensions) {
    const dimFindings = findings.filter((f) => f.dimension === dim);
    const counts = {
      critical: dimFindings.filter((f) => f.severity === 'critical').length,
      high: dimFindings.filter((f) => f.severity === 'high').length,
      medium: dimFindings.filter((f) => f.severity === 'medium').length,
      low: dimFindings.filter((f) => f.severity === 'low').length,
    };
    tableRows.push(
      `| ${dimLabels[dim]} | ${dimFindings.length} | ${counts.critical} | ${counts.high} | ${counts.medium} | ${counts.low} |`,
    );
  }

  // Overall risk
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');
  let risk: string;
  if (hasCritical) {
    risk = '🔴 HIGH — critical findings must be addressed before merge.';
  } else if (hasHigh) {
    risk = '🟠 MEDIUM — high-severity findings should be reviewed.';
  } else if (findings.length > 0) {
    risk = '🟡 LOW — minor findings for your review.';
  } else {
    risk = '🟢 NONE — no issues found.';
  }

  const body = `## GemReview Summary 🤖

**PR:** ${meta.title}
**Reviewed:** ${meta.filesReviewed} files, ${meta.linesChanged} lines changed
**Model:** ${meta.model} | **Duration:** ${meta.durationSeconds}s

---

| Dimension | Findings | Critical | High | Medium | Low |
|-----------|----------|----------|------|--------|-----|
${tableRows.join('\n')}

**Overall Risk:** ${risk}

---
*GemReview v1.0.0*`;

  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pull_number,
      body,
    });
  } catch (err: any) {
    await logger.warn(`Failed to post summary comment: ${err.message}`);
  }
}
