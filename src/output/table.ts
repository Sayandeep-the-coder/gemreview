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

const DIMENSION_LABELS: Record<string, string> = {
  bugs: 'Code Quality',
  security: 'Security',
  tests: 'Test Coverage',
  optimisation: 'Optimisation',
};

export async function renderSummaryTable(findings: Finding[]): Promise<string> {
  const chalk = (await import('chalk')).default;

  const dimensions = ['bugs', 'security', 'tests', 'optimisation'] as const;
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold('  Review Summary'));
  lines.push(chalk.gray('  ─────────────────────────────────────────────────────────────'));
  lines.push(
    chalk.gray(
      '  Dimension            │ Total │ Critical │ High │ Medium │ Low',
    ),
  );
  lines.push(chalk.gray('  ─────────────────────────────────────────────────────────────'));

  for (const dim of dimensions) {
    const dimFindings = findings.filter((f) => f.dimension === dim);
    const counts = {
      critical: dimFindings.filter((f) => f.severity === 'critical').length,
      high: dimFindings.filter((f) => f.severity === 'high').length,
      medium: dimFindings.filter((f) => f.severity === 'medium').length,
      low: dimFindings.filter((f) => f.severity === 'low').length,
    };

    const emoji = DIMENSION_EMOJIS[dim] || '';
    const label = `${emoji} ${DIMENSION_LABELS[dim] || dim}`;
    const total = dimFindings.length;
    const criticalStr = counts.critical > 0 ? chalk.red(String(counts.critical)) : chalk.gray('0');
    const highStr = counts.high > 0 ? chalk.yellow(String(counts.high)) : chalk.gray('0');
    const mediumStr = counts.medium > 0 ? chalk.cyan(String(counts.medium)) : chalk.gray('0');
    const lowStr = counts.low > 0 ? chalk.white(String(counts.low)) : chalk.gray('0');

    lines.push(
      `  ${label.padEnd(22)}│ ${String(total).padStart(5)} │ ${criticalStr.toString().padStart(8)} │ ${highStr.toString().padStart(4)} │ ${mediumStr.toString().padStart(6)} │ ${lowStr.toString().padStart(3)}`,
    );
  }

  lines.push(chalk.gray('  ─────────────────────────────────────────────────────────────'));

  // Overall risk assessment
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');
  let risk: string;
  if (hasCritical) {
    risk = chalk.red('🔴 HIGH — critical findings must be addressed before merge');
  } else if (hasHigh) {
    risk = chalk.yellow('🟠 MEDIUM — high-severity findings should be reviewed');
  } else if (findings.length > 0) {
    risk = chalk.cyan('🟡 LOW — minor findings for your review');
  } else {
    risk = chalk.green('🟢 NONE — no issues found');
  }

  lines.push(`  Overall Risk: ${risk}`);
  lines.push('');

  return lines.join('\n');
}
