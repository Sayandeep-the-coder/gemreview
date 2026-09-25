import type { FileDiff } from '../github/pr.js';
import type { ReviewConfig } from '../config/schema.js';
import type { Dimension, Finding } from '../gemini/parser.js';
import { createGeminiClient } from '../gemini/client.js';
import { buildPrompt, buildUnifiedPrompt } from '../gemini/prompts.js';
import { parseFindings } from '../gemini/parser.js';
import { chunkDiffs } from './chunker.js';
import * as logger from '../output/logger.js';

export async function runReview(
  config: ReviewConfig,
  diffs: FileDiff[],
  onProgress?: (status: string) => void,
): Promise<Finding[]> {
  let effectiveModel = config.model;
  let maxTokens = 80000;

  if (config.gemini_api_key) {
    try {
      const { fetchCurrentModel, getSafeChunkTokens } = await import('../gemini/models.js');
      const liveModel = await fetchCurrentModel(config.gemini_api_key, config.model);
      effectiveModel = liveModel.id;
      maxTokens = getSafeChunkTokens(liveModel);
    } catch {
      // Continue gracefully with config.model if offline
    }
  }

  const gemini = createGeminiClient(config.gemini_api_key || '', effectiveModel);
  const chunks = chunkDiffs(diffs, maxTokens);

  const allFindings: Finding[] = [];
  const totalChunks = chunks.length;

  // Process chunks with unified multi-dimension review in a single pass for maximum speed
  for (let c = 0; c < totalChunks; c++) {
    const chunk = chunks[c];
    const chunkInfo = totalChunks > 1 ? ` (chunk ${c + 1}/${totalChunks})` : '';

    const currentModelName =
      typeof gemini.getActiveModel === 'function' ? gemini.getActiveModel() : effectiveModel;

    if (onProgress) {
      const dimSummary =
        config.dimensions.length === 4 ? 'all dimensions' : config.dimensions.join('+');
      onProgress(
        `Analysing ${dimSummary}${chunkInfo} with ${currentModelName} (${c + 1}/${totalChunks})...`,
      );
    }

    // Build combined diff content for this chunk
    const diffContent = chunk
      .map((file) => `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`)
      .join('\n\n');

    const { system, user } = buildUnifiedPrompt(config.dimensions, diffContent);

    try {
      const rawResponse = await gemini.review(system, user);
      const findings = parseFindings(rawResponse);
      allFindings.push(...findings);
    } catch (error: any) {
      // Graceful degradation: log warning and continue with remaining chunks
      await logger.warn(
        `Failed to analyse chunk ${c + 1}/${totalChunks}: ${error.message}. Continuing with remaining chunks...`,
      );
      // Small cooldown to avoid cascading rate-limit spikes on subsequent chunks
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
