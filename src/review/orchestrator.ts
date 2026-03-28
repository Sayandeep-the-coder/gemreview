import type { FileDiff } from '../github/pr.js';
import type { ReviewConfig } from '../config/schema.js';
import type { Dimension, Finding } from '../gemini/parser.js';
import { createGeminiClient } from '../gemini/client.js';
import { buildPrompt } from '../gemini/prompts.js';
import { parseFindings } from '../gemini/parser.js';
import { chunkDiffs } from './chunker.js';
import * as logger from '../output/logger.js';

export async function runReview(
  config: ReviewConfig,
  diffs: FileDiff[],
): Promise<Finding[]> {
  const gemini = createGeminiClient(config.gemini_api_key, config.model);
  const chunks = chunkDiffs(diffs);

  // For each enabled dimension, run analysis in parallel
  const dimensionPromises = config.dimensions.map(async (dimension: Dimension) => {
    const dimensionFindings: Finding[] = [];

    for (const chunk of chunks) {
      // Build combined diff content for this chunk
      const diffContent = chunk
        .map((file) => `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`)
        .join('\n\n');

      const { system, user } = buildPrompt(dimension, diffContent);

      try {
        const rawResponse = await gemini.review(system, user);
        const findings = parseFindings(rawResponse, dimension);
        dimensionFindings.push(...findings);
      } catch (error: any) {
        // Graceful degradation: log warning and continue with remaining chunks
        await logger.warn(
          `Failed to analyse chunk for ${dimension}: ${error.message}. Continuing with remaining chunks...`,
        );
      }
    }

    return dimensionFindings;
  });

  // Run all dimensions in parallel
  const results = await Promise.allSettled(dimensionPromises);

  // Collect all findings
  const allFindings: Finding[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allFindings.push(...result.value);
    } else {
      await logger.warn(`Dimension analysis failed: ${result.reason}`);
    }
  }

  // Deduplicate: same file + line + dimension → keep higher confidence entry
  const deduped = deduplicateFindings(allFindings);

  return deduped;
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const map = new Map<string, Finding>();

  for (const finding of findings) {
    const key = `${finding.file}:${finding.line}:${finding.dimension}`;
    const existing = map.get(key);

    if (!existing || finding.confidence > existing.confidence) {
      map.set(key, finding);
    }
  }

  return Array.from(map.values());
}
