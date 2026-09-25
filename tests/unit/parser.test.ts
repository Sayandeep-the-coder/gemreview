import { describe, it, expect } from 'vitest';
import { parseFindings } from '../../src/gemini/parser.js';

describe('parseFindings', () => {
  it('should parse valid JSON array into Finding[]', () => {
    const json = JSON.stringify([
      {
        file: 'test.ts',
        line: 10,
        dimension: 'bugs',
        severity: 'high',
        title: 'Null check missing',
        description: 'Missing null check on param',
        suggestion: 'Add if (!param) check',
        confidence: 0.9,
      },
    ]);

    const result = parseFindings(json, 'bugs');
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('test.ts');
    expect(result[0].line).toBe(10);
    expect(result[0].dimension).toBe('bugs');
    expect(result[0].severity).toBe('high');
    expect(result[0].confidence).toBe(0.9);
  });

  it('should return empty array for malformed JSON without throwing', () => {
    const result = parseFindings('not valid json {{{', 'bugs');
    expect(result).toEqual([]);
  });

  it('should return empty array for non-array JSON', () => {
    const result = parseFindings('{"key": "value"}', 'bugs');
    expect(result).toEqual([]);
  });

  it('should skip findings with missing required fields', () => {
    const json = JSON.stringify([
      {
        file: 'test.ts',
        // missing line, dimension, severity, title, description, confidence
      },
      {
        file: 'test.ts',
        line: 5,
        dimension: 'bugs',
        severity: 'medium',
        title: 'Valid finding',
        description: 'This is valid',
        confidence: 0.8,
      },
    ]);

    const result = parseFindings(json, 'bugs');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Valid finding');
  });

  it('should clamp confidence to 0.0–1.0', () => {
    const json = JSON.stringify([
      {
        file: 'a.ts',
        line: 1,
        dimension: 'bugs',
        severity: 'low',
        title: 'Over-confident',
        description: 'desc',
        confidence: 1.5,
      },
      {
        file: 'b.ts',
        line: 2,
        dimension: 'bugs',
        severity: 'low',
        title: 'Under-confident',
        description: 'desc',
        confidence: -0.5,
      },
    ]);

    const result = parseFindings(json, 'bugs');
    expect(result).toHaveLength(2);
    expect(result[0].confidence).toBe(1.0);
    expect(result[1].confidence).toBe(0.0);
  });

  it('should skip findings with invalid severity values', () => {
    const json = JSON.stringify([
      {
        file: 'test.ts',
        line: 1,
        dimension: 'bugs',
        severity: 'EXTREME',
        title: 'Bad severity',
        description: 'desc',
        confidence: 0.5,
      },
    ]);

    const result = parseFindings(json, 'bugs');
    expect(result).toHaveLength(0);
  });

  it('should skip findings with invalid dimension values', () => {
    const json = JSON.stringify([
      {
        file: 'test.ts',
        line: 1,
        dimension: 'performance',
        severity: 'high',
        title: 'Bad dimension',
        description: 'desc',
        confidence: 0.5,
      },
    ]);

    const result = parseFindings(json, 'bugs');
    expect(result).toHaveLength(0);
  });

  it('should handle suggestion field being optional', () => {
    const json = JSON.stringify([
      {
        file: 'test.ts',
        line: 1,
        dimension: 'security',
        severity: 'critical',
        title: 'Issue',
        description: 'description',
        confidence: 0.95,
      },
    ]);

    const result = parseFindings(json, 'security');
    expect(result).toHaveLength(1);
    expect(result[0].suggestion).toBeUndefined();
  });

  it('should parse empty JSON array', () => {
    const result = parseFindings('[]', 'bugs');
    expect(result).toEqual([]);
  });

  it('should strip markdown code fences before parsing', () => {
    const markdown = '```json\n[{"file":"a.ts","line":1,"dimension":"bugs","severity":"low","title":"Test","description":"desc","confidence":0.8}]\n```';
    const result = parseFindings(markdown, 'bugs');
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('a.ts');
  });

  it('should repair and salvage valid findings from a truncated JSON array', () => {
    // Simulates Gemini response cut off mid-string at position 1634
    const truncated = `[
      {
        "file": "src/utils.ts",
        "line": 15,
        "dimension": "tests",
        "severity": "medium",
        "title": "Missing edge case tests",
        "description": "Add tests for null inputs",
        "confidence": 0.9
      },
      {
        "file": "src/service.ts",
        "line": 42,
        "dimension": "tests",
        "severity": "high",
        "title": "Unterminated string at position`;

    const result = parseFindings(truncated, 'tests');
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('src/utils.ts');
    expect(result[0].title).toBe('Missing edge case tests');
  });

  it('should extract JSON from responses with thinking/preamble text', () => {
    const responseWithThoughts = `* Input: A diff of a file test.ts
* Goal: Review for bugs
* Potential issues: None

\`\`\`json
[
  {
    "file": "src/app.ts",
    "line": 12,
    "dimension": "bugs",
    "severity": "high",
    "title": "Null dereference",
    "description": "Object could be undefined",
    "confidence": 0.85
  }
]
\`\`\``;

    const result = parseFindings(responseWithThoughts, 'bugs');
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('src/app.ts');
    expect(result[0].title).toBe('Null dereference');
  });

  it('should extract findings from wrapper objects like { "bugs": [...] }', () => {
    const wrappedObj = JSON.stringify({
      bugs: [
        {
          file: 'src/main.ts',
          line: 20,
          dimension: 'bugs',
          severity: 'medium',
          title: 'Unused variable',
          description: 'Variable declared but never used',
          confidence: 0.9,
        },
      ],
    });

    const result = parseFindings(wrappedObj, 'bugs');
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('src/main.ts');
  });

  it('should return empty array for conversational no-issue statements', () => {
    const conversational = 'Upon reviewing the unified diff, I found no bugs or code quality issues. Everything looks clean.';
    const result = parseFindings(conversational, 'bugs');
    expect(result).toEqual([]);
  });
});
