import type { FileDiff } from '../github/pr.js';

export function chunkDiffs(diffs: FileDiff[], maxTokens: number = 80000): FileDiff[][] {
  if (diffs.length === 0) return [];

  const chunks: FileDiff[][] = [];
  let currentChunk: FileDiff[] = [];
  let currentTokens = 0;

  for (const diff of diffs) {
    const estimatedTokens = Math.ceil(diff.patch.length / 4);

    // If a single file exceeds maxTokens, truncate and add as its own chunk
    if (estimatedTokens > maxTokens) {
      // Flush current chunk if non-empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }

      const maxChars = maxTokens * 4;
      const truncatedPatch =
        diff.patch.substring(0, maxChars) + '\n[TRUNCATED]';
      chunks.push([
        {
          ...diff,
          patch: truncatedPatch,
        },
      ]);
      continue;
    }

    // If adding this file would exceed the limit, start a new chunk
    if (currentTokens + estimatedTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(diff);
    currentTokens += estimatedTokens;
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
