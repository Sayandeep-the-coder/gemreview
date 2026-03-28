import micromatch from 'micromatch';
import type { Finding } from '../gemini/parser.js';
import type { FileDiff } from '../github/pr.js';

const SEVERITY_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function filterBySeverity(findings: Finding[], threshold: string): Finding[] {
  const thresholdLevel = SEVERITY_ORDER[threshold] ?? 0;
  return findings.filter(
    (f) => (SEVERITY_ORDER[f.severity] ?? 0) >= thresholdLevel,
  );
}

export function filterByPaths(diffs: FileDiff[], excludePatterns: string[]): FileDiff[] {
  if (excludePatterns.length === 0) return diffs;

  // Separate patterns: those with '/' are path patterns, others need matchBase
  const pathPatterns = excludePatterns.filter((p) => p.includes('/'));
  const basePatterns = excludePatterns.filter((p) => !p.includes('/'));

  const filenames = diffs.map((d) => d.filename);

  const excludedByPath = new Set(
    pathPatterns.length > 0 ? micromatch(filenames, pathPatterns) : [],
  );
  const excludedByBase = new Set(
    basePatterns.length > 0 ? micromatch(filenames, basePatterns, { matchBase: true }) : [],
  );

  return diffs.filter(
    (diff) => !excludedByPath.has(diff.filename) && !excludedByBase.has(diff.filename),
  );
}

export function capComments(findings: Finding[], max: number): Finding[] {
  if (findings.length <= max) return findings;

  // Sort by severity desc, then confidence desc
  const sorted = [...findings].sort((a, b) => {
    const severityDiff =
      (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });

  return sorted.slice(0, max);
}
