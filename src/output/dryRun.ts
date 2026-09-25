import type { Finding } from '../gemini/parser.js';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const DIMENSION_EMOJIS: Record<string, string> = {
  bugs: '🐛',
  security: '🔒',
  tests: '🧪',
  optimisation: '⚡',
};

export async function renderDryRun(findings: Finding[]): Promise<void> {
  const chalk = (await import('chalk')).default;

  if (findings.length === 0) {
    console.log(chalk.green('\n  ✅ No findings to report.\n'));
    return;
  }

  // Group by file
  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    const existing = byFile.get(finding.file) || [];
    existing.push(finding);
    byFile.set(finding.file, existing);
  }

  console.log(chalk.bold(`\n  🔍 Dry Run Results — ${findings.length} finding(s)\n`));

  for (const [file, fileFindings] of byFile) {
    console.log(chalk.bold.underline(`  📄 ${file}`));

    // Sort by severity descending
    fileFindings.sort(
      (a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0),
    );

    for (const finding of fileFindings) {
      const emoji = DIMENSION_EMOJIS[finding.dimension] || '❓';
      const severityColor =
        finding.severity === 'critical'
          ? chalk.red
          : finding.severity === 'high'
            ? chalk.yellow
            : finding.severity === 'medium'
              ? chalk.cyan
              : chalk.gray;

      console.log('');
      console.log(
        `    ${emoji} ${chalk.bold(finding.dimension.toUpperCase())} | ${severityColor(finding.severity.toUpperCase())} | Line ${finding.line}`,
      );
      console.log(`    ${chalk.bold(finding.title)}`);
      console.log(`    ${finding.description}`);
      if (finding.suggestion) {
        console.log(`    💡 ${chalk.italic(finding.suggestion)}`);
      }
      console.log(
        `    ${chalk.gray(`Confidence: ${Math.round(finding.confidence * 100)}%`)}`,
      );
    }

    console.log('');
  }
}
