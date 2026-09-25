import { describe, it, expect } from 'vitest';
import { chunkDiffs } from '../../src/review/chunker.js';
import type { FileDiff } from '../../src/github/pr.js';

function createDiff(filename: string, patchLength: number): FileDiff {
  return {
    filename,
    status: 'modified',
    patch: 'a'.repeat(patchLength),
    additions: 10,
    deletions: 5,
  };
}

describe('chunkDiffs', () => {
  it('should return empty array for empty diffs', () => {
    const result = chunkDiffs([]);
    expect(result).toEqual([]);
  });

  it('should return a single chunk for small diffs under maxTokens', () => {
    const diffs = [
      createDiff('file1.ts', 100),
      createDiff('file2.ts', 200),
    ];

    const result = chunkDiffs(diffs, 80000);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('should split large diffs into multiple chunks', () => {
    // Each file ~10000 tokens (40000 chars / 4), maxTokens = 15000
    const diffs = [
      createDiff('file1.ts', 40000),
      createDiff('file2.ts', 40000),
      createDiff('file3.ts', 40000),
    ];

    const result = chunkDiffs(diffs, 15000);
    expect(result.length).toBeGreaterThan(1);
  });

  it('should truncate a single oversized file with [TRUNCATED] marker', () => {
    const maxTokens = 100;
    const oversizedDiff = createDiff('huge.ts', maxTokens * 4 + 1000);

    const result = chunkDiffs([oversizedDiff], maxTokens);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
    expect(result[0][0].patch).toContain('[TRUNCATED]');
  });

  it('should handle mix of normal and oversized files', () => {
    const diffs = [
      createDiff('small.ts', 100),
      createDiff('huge.ts', 400000),
      createDiff('medium.ts', 200),
    ];

    const result = chunkDiffs(diffs, 1000);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Find the chunk with the oversized file
    const oversizedChunk = result.find((chunk) =>
      chunk.some((d) => d.filename === 'huge.ts'),
    );
    expect(oversizedChunk).toBeDefined();
    expect(oversizedChunk![0].patch).toContain('[TRUNCATED]');
  });
});
