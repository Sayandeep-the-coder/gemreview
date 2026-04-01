import type { Finding } from '../gemini/parser.js';
import type { FileDiff } from '../github/pr.js';

export interface AgentPromptInput {
  findings:  Finding[];
  diffs:     FileDiff[];
  prUrl:     string;
  prTitle:   string;
  model:     string;
}

// Maps dimension to emoji + label
const DIMENSION_META: Record<string, { emoji: string; label: string }> = {
  bugs:         { emoji: '🐛', label: 'Bug / Code Quality' },
  security:     { emoji: '🔒', label: 'Security Vulnerability' },
  tests:        { emoji: '🧪', label: 'Test Coverage Gap' },
  optimisation: { emoji: '⚡', label: 'Performance Optimisation' },
};

// Maps severity to urgency label
const SEVERITY_LABEL: Record<string, string> = {
  critical: '🔴 CRITICAL — fix before merge',
  high:     '🟠 HIGH — fix before merge',
  medium:   '🟡 MEDIUM — fix in this PR or follow-up',
  low:      '🔵 LOW — optional improvement',
};

/**
 * Extracts the lines around a given line number from a unified diff patch.
 * Returns up to `contextLines` lines before and after the target line,
 * plus the target line itself, preserving the +/- diff markers.
 */
function extractPatchContext(
  patch: string,
  targetLine: number,
  contextLines = 5
): string {
  if (!patch) return '(patch context not available for this file)';

  const lines = patch.split('\n');
  let currentLine = 0;
  const contextBuffer: string[] = [];

  for (const rawLine of lines) {
    // Parse @@ -a,b +c,d @@ hunk headers to track line numbers
    const hunkMatch = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }

    if (rawLine.startsWith('-')) continue; // skip removed lines for line counting
    currentLine++;

    const distance = Math.abs(currentLine - targetLine);
    if (distance <= contextLines) {
      // Annotate the exact target line
      const marker = currentLine === targetLine ? ' ◀ ISSUE HERE' : '';
      contextBuffer.push(`${String(currentLine).padStart(4)} | ${rawLine}${marker}`);
    }
  }

  return contextBuffer.length > 0
    ? contextBuffer.join('\n')
    : `(line ${targetLine} not found in patch context)`;
}

/**
 * Groups findings by file path, sorted by severity (critical first).
 */
function groupByFile(findings: Finding[]): Map<string, Finding[]> {
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  const map = new Map<string, Finding[]>();
  for (const f of sorted) {
    if (!map.has(f.file)) map.set(f.file, []);
    map.get(f.file)!.push(f);
  }
  return map;
}

/**
 * Builds the full AI agent prompt string.
 */
export function generateAgentPrompt(input: AgentPromptInput): string {
  const { findings, diffs, prUrl, prTitle, model } = input;

  if (findings.length === 0) {
    return [
      '# GemReview Agent Prompt',
      '',
      `> PR: ${prTitle}`,
      `> URL: ${prUrl}`,
      '',
      '✅ No findings to fix. The PR looks clean.',
    ].join('\n');
  }

  // Build a lookup map from filename → FileDiff for patch context
  const diffMap = new Map<string, FileDiff>(diffs.map(d => [d.filename, d]));

  // Count by severity for the header summary
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.severity in counts) {
      counts[f.severity as keyof typeof counts]++;
    }
  }

  const grouped = groupByFile(findings);
  const fileList = [...grouped.keys()];

  const lines: string[] = [];

  // ── HEADER ──────────────────────────────────────────────────────────────────
  lines.push('# GemReview — AI Agent Fix Prompt');
  lines.push('');
  lines.push('You are an expert software engineer.');
  lines.push('Fix every issue listed below. Each issue is tagged with its exact');
  lines.push('file path and line number. Patch context is included so you can');
  lines.push('locate the code immediately without searching.');
  lines.push('');
  lines.push('Do not ask clarifying questions. Fix everything in one pass.');
  lines.push('After fixing, verify against the DONE CRITERIA at the bottom.');
  lines.push('');

  // ── PR METADATA ─────────────────────────────────────────────────────────────
  lines.push('## PR Details');
  lines.push('');
  lines.push(`- **Title:** ${prTitle}`);
  lines.push(`- **URL:** ${prUrl}`);
  lines.push(`- **Reviewed by:** GemReview (model: ${model})`);
  lines.push(`- **Total findings:** ${findings.length}`);
  lines.push(
    `- **By severity:** 🔴 ${counts.critical} critical · ` +
    `🟠 ${counts.high} high · ` +
    `🟡 ${counts.medium} medium · ` +
    `🔵 ${counts.low} low`
  );
  lines.push('');

  // ── FILES AFFECTED ───────────────────────────────────────────────────────────
  lines.push('## Files to Change');
  lines.push('');
  lines.push('These are the only files that need edits:');
  lines.push('');
  for (const file of fileList) {
    const filefindings = grouped.get(file)!;
    const hasCritical = filefindings.some(f => f.severity === 'critical');
    const hasHigh     = filefindings.some(f => f.severity === 'high');
    const urgency     = hasCritical ? '🔴' : hasHigh ? '🟠' : '🟡';
    lines.push(`- ${urgency} \`${file}\` — ${filefindings.length} finding(s)`);
  }
  lines.push('');

  // ── FINDINGS BY FILE ─────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('## Findings — Grouped by File');
  lines.push('');

  let findingIndex = 1;

  for (const [file, fileFindings] of grouped) {
    const diff = diffMap.get(file);

    lines.push(`### 📄 \`${file}\``);
    lines.push('');

    for (const finding of fileFindings) {
      const meta = DIMENSION_META[finding.dimension] ?? { emoji: '❓', label: finding.dimension };

      lines.push(
        `#### Finding ${findingIndex} — ${meta.emoji} ${meta.label} | ` +
        `${SEVERITY_LABEL[finding.severity] || finding.severity}`
      );
      lines.push('');

      // File + line tag — the most important part for the agent
      lines.push('**Location:**');
      lines.push('```');
      lines.push(`File: ${file}`);
      lines.push(`Line: ${finding.line}`);
      lines.push('```');
      lines.push('');

      lines.push('**Issue:**');
      lines.push(`${finding.description}`);
      lines.push('');

      if (finding.suggestion) {
        lines.push('**Fix:**');
        lines.push(`${finding.suggestion}`);
        lines.push('');
      }

      // Patch context — the actual diff lines around the issue
      const patchContext = diff
        ? extractPatchContext(diff.patch, finding.line, 5)
        : '(patch context not available for this file)';

      lines.push('**Patch context** (lines surrounding the issue):');
      lines.push('```diff');
      lines.push(patchContext);
      lines.push('```');
      lines.push('');

      findingIndex++;
    }

    lines.push('---');
    lines.push('');
  }

  // ── DONE CRITERIA ────────────────────────────────────────────────────────────
  lines.push('## Done Criteria');
  lines.push('');
  lines.push('Your work is complete when every item below is checked:');
  lines.push('');

  for (const [file, fileFindings] of grouped) {
    lines.push(`**\`${file}\`**`);
    for (const f of fileFindings) {
      const meta = DIMENSION_META[f.dimension] ?? { emoji: '❓', label: f.dimension };
      lines.push(`- [ ] Line ${f.line}: ${meta.emoji} ${f.title}`);
    }
    lines.push('');
  }

  lines.push('After making all changes:');
  lines.push('- [ ] The project builds without errors (`npm run build`)');
  lines.push('- [ ] All tests pass (`npm test`)');
  lines.push('- [ ] No new `any` types introduced');
  lines.push('- [ ] No secrets or API keys added anywhere');
  lines.push('');
  lines.push('---');
  lines.push('*Generated by GemReview — https://github.com/your-org/gemreview*');

  return lines.join('\n');
}
