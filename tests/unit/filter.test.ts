import { describe, it, expect } from 'vitest';
import { filterBySeverity, filterByPaths, capComments } from '../../src/review/filter.js';
import type { Finding } from '../../src/gemini/parser.js';
import type { FileDiff } from '../../src/github/pr.js';

function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    file: 'test.ts',
    line: 1,
    dimension: 'bugs',
    severity: 'medium',
    title: 'Test finding',
    description: 'A test finding',
    confidence: 0.8,
    ...overrides,
  };
}

function createFileDiff(filename: string): FileDiff {
  return {
    filename,
    status: 'modified',
    patch: 'some patch content',
    additions: 5,
    deletions: 2,
  };
}

describe('filterBySeverity', () => {
  it('should keep findings at or above the threshold', () => {
    const findings = [
      createFinding({ severity: 'low' }),
      createFinding({ severity: 'medium' }),
      createFinding({ severity: 'high' }),
      createFinding({ severity: 'critical' }),
    ];

    const result = filterBySeverity(findings, 'high');
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.severity === 'high' || f.severity === 'critical')).toBe(true);
  });

  it('should return all findings when threshold is low', () => {
    const findings = [
      createFinding({ severity: 'low' }),
      createFinding({ severity: 'medium' }),
    ];

    const result = filterBySeverity(findings, 'low');
    expect(result).toHaveLength(2);
  });

  it('should return only critical when threshold is critical', () => {
    const findings = [
      createFinding({ severity: 'low' }),
      createFinding({ severity: 'high' }),
      createFinding({ severity: 'critical' }),
    ];

    const result = filterBySeverity(findings, 'critical');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });
});

describe('filterByPaths', () => {
  it('should exclude files matching glob patterns', () => {
    const diffs = [
      createFileDiff('src/index.ts'),
      createFileDiff('package-lock.json'),
      createFileDiff('dist/bundle.js'),
      createFileDiff('src/utils.ts'),
    ];

    const result = filterByPaths(diffs, ['*lock*', 'dist/**']);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.filename)).toEqual(['src/index.ts', 'src/utils.ts']);
  });

  it('should return all diffs when no patterns provided', () => {
    const diffs = [createFileDiff('a.ts'), createFileDiff('b.ts')];
    const result = filterByPaths(diffs, []);
    expect(result).toHaveLength(2);
  });

  it('should exclude minified files', () => {
    const diffs = [
      createFileDiff('src/app.ts'),
      createFileDiff('dist/app.min.js'),
    ];

    const result = filterByPaths(diffs, ['*.min.js']);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('src/app.ts');
  });
});

describe('capComments', () => {
  it('should return all findings when under the cap', () => {
    const findings = [createFinding(), createFinding()];
    const result = capComments(findings, 10);
    expect(result).toHaveLength(2);
  });

  it('should return exactly N findings sorted by severity desc', () => {
    const findings = [
      createFinding({ severity: 'low', confidence: 0.9 }),
      createFinding({ severity: 'critical', confidence: 0.8 }),
      createFinding({ severity: 'medium', confidence: 0.7 }),
      createFinding({ severity: 'high', confidence: 0.6 }),
    ];

    const result = capComments(findings, 2);
    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe('critical');
    expect(result[1].severity).toBe('high');
  });

  it('should use confidence as tiebreaker for same severity', () => {
    const findings = [
      createFinding({ severity: 'high', confidence: 0.5 }),
      createFinding({ severity: 'high', confidence: 0.9 }),
      createFinding({ severity: 'high', confidence: 0.7 }),
    ];

    const result = capComments(findings, 2);
    expect(result).toHaveLength(2);
    expect(result[0].confidence).toBe(0.9);
    expect(result[1].confidence).toBe(0.7);
  });
});
