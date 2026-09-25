import { GoogleGenerativeAI } from '@google/generative-ai';

// Definitions for the backend version of the orchestrator
export type Dimension = 'bugs' | 'security' | 'tests' | 'optimisation';

export interface Finding {
  file: string;
  line: number;
  dimension: Dimension;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  confidence: number; // 0 to 1
  snippet?: string;
  suggestion?: string;
}

export interface FileDiff {
  filename: string;
  patch: string;
}

function getModelDelay(modelId: string): number {
  const lower = modelId.toLowerCase();
  if (lower.includes('pro')) return 31500;
  if (lower.includes('gemma')) return 12000;
  if (lower.includes('thinking')) return 6300;
  if (lower.includes('flash-lite') || lower.includes('flash-8b')) return 2100;
  return 4200; // default Flash models
}

function getFallbackChain(modelId: string): string[] {
  const clean = modelId.replace(/^models\//, '').trim().toLowerCase();
  const pool = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
  return pool.filter((m) => m !== clean);
}

function extractRetryDelayMs(error: any): number | null {
  if (!error) return null;
  const details = error.errorDetails || error.statusDetails || error.details;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item && item.retryDelay) {
        if (typeof item.retryDelay === 'string') {
          const match = item.retryDelay.match(/^(\d+(?:\.\d+)?)s?$/);
          if (match) {
            const sec = parseFloat(match[1]);
            if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
          }
        } else if (typeof item.retryDelay === 'object') {
          const sec = Number(item.retryDelay.seconds || 0);
          const nanos = Number(item.retryDelay.nanos || 0);
          const totalMs = Math.ceil(sec * 1000 + nanos / 1e6);
          if (totalMs > 0) return totalMs;
        } else if (typeof item.retryDelay === 'number' && item.retryDelay > 0) {
          return Math.ceil(item.retryDelay * 1000);
        }
      }
    }
  }

  let text = '';
  if (typeof error === 'string') {
    text = error;
  } else {
    text = error.message || '';
    try {
      text += ' ' + JSON.stringify(error);
    } catch {
      // ignore
    }
  }

  const retryDelayMatch = text.match(/"?retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s?"?/i);
  if (retryDelayMatch && retryDelayMatch[1]) {
    const sec = parseFloat(retryDelayMatch[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
  }

  const retryInMatch = text.match(/retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)s/i);
  if (retryInMatch && retryInMatch[1]) {
    const sec = parseFloat(retryInMatch[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
  }

  return null;
}

/**
 * Backend AI Service for performing Gemini reviews with dynamic rate limiting & failover.
 */
export async function runServerReview(
  apiKey: string,
  modelName: string,
  dimensions: Dimension[],
  diffs: FileDiff[]
): Promise<Finding[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let activeModel = modelName;
  let lastRequestEndTime = 0;
  const triedModels = new Set<string>();
  triedModels.add(activeModel.toLowerCase());

  async function paceRequest() {
    const minDelay = getModelDelay(activeModel);
    if (minDelay > 0 && lastRequestEndTime > 0) {
      const elapsed = Date.now() - lastRequestEndTime;
      if (elapsed < minDelay) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed));
      }
    }
  }

  const chunks = chunkDiffs(diffs);
  const allFindings: Finding[] = [];

  for (const chunk of chunks) {
    const diffContent = chunk
      .map((file) => `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`)
      .join('\n\n');

    const { system, user } = buildPrompt(dimensions, diffContent);
    const maxRetries = 4;
    const fallbackDelays = [4000, 8000, 16000, 24000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await paceRequest();
        const model = genAI.getGenerativeModel({ model: activeModel });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
          },
        });

        lastRequestEndTime = Date.now();
        const response = result.response.text();
        const findings = parseFindings(response, dimensions[0] || 'bugs');
        allFindings.push(...findings);
        break; // Chunk succeeded
      } catch (err: any) {
        lastRequestEndTime = Date.now();
        const msg = (err.message || '').toLowerCase();
        const is429 =
          err.status === 429 ||
          msg.includes('429') ||
          msg.includes('resource_exhausted') ||
          msg.includes('quota exceeded') ||
          msg.includes('rate limit');
        const is503 =
          err.status === 503 ||
          err.status === 500 ||
          msg.includes('503') ||
          msg.includes('overloaded') ||
          msg.includes('service unavailable');
        const isDaily = is429 && (msg.includes('requests per day') || msg.includes('daily'));

        if (isDaily) {
          const fallbacks = getFallbackChain(activeModel).filter(m => !triedModels.has(m));
          if (fallbacks.length > 0) {
            console.warn(`[AI] Daily quota reached for ${activeModel}. Switching to ${fallbacks[0]}`);
            activeModel = fallbacks[0];
            triedModels.add(activeModel);
            continue;
          }
        }

        if (is503 && attempt >= 1) {
          const fallbacks = getFallbackChain(activeModel).filter(m => !triedModels.has(m));
          if (fallbacks.length > 0) {
            console.warn(`[AI] Model ${activeModel} overloaded (503). Failing over to ${fallbacks[0]}`);
            activeModel = fallbacks[0];
            triedModels.add(activeModel);
            continue;
          }
        }

        if ((is429 || is503) && attempt < maxRetries) {
          let delay = fallbackDelays[attempt] || 16000;
          const googleDelay = extractRetryDelayMs(err);
          if (googleDelay && googleDelay > 0) {
            delay = Math.min(65000, googleDelay + 1500);
          }

          // Dynamic upgrade for constrained models (Pro, Gemma)
          const isConstrained = activeModel.toLowerCase().includes('pro') || activeModel.toLowerCase().includes('gemma');
          if (isConstrained && (delay >= 15000 || attempt >= 1)) {
            const fallbacks = getFallbackChain(activeModel).filter(m => !triedModels.has(m));
            if (fallbacks.length > 0) {
              console.warn(`[AI] Switching ${activeModel} -> ${fallbacks[0]} due to rate limit`);
              activeModel = fallbacks[0];
              triedModels.add(activeModel);
              continue;
            }
          }

          console.warn(`[AI] Retry attempt ${attempt + 1}/${maxRetries} after ${Math.ceil(delay / 1000)}s...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        console.error(`[AI] Error analyzing chunk (${activeModel}):`, err.message);
        break; // Stop retrying this chunk
      }
    }
  }

  return deduplicateFindings(allFindings);
}

/**
 * Simplified prompt builder mirrored from CLI
 */
function buildPrompt(dimensions: Dimension[], diff: string) {
  const dims = dimensions.map((d) => d.toUpperCase()).join(', ');
  const system = `You are GemReview, a world-class AI code reviewer.
Focus strictly on: ${dims}.
Output MUST be valid JSON (no markdown blocks).
JSON structure: Array<{ file: string, line: number, dimension: 'bugs'|'security'|'tests'|'optimisation', severity: 'low'|'medium'|'high'|'critical', message: string, confidence: number, suggestion?: string }>
Only report real issues. If no issues, return [].`;

  const user = `Analyse this diff for (${dims}):\n\n${diff}`;
  return { system, user };
}

/**
 * Resilient finding parser with markdown code block, bracket extraction, and truncation repair
 */
function parseFindings(raw: string, dimension: Dimension): Finding[] {
  try {
    const cleaned = raw.trim();
    let parsed: any = null;

    // 1. Try markdown code block extraction
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        parsed = JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // 2. Direct parse
    if (!parsed) {
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fall through
      }
    }

    // 3. Extract between outermost [ and ]
    if (!parsed) {
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end > start) {
        try {
          parsed = JSON.parse(cleaned.substring(start, end + 1));
        } catch {
          // Fall through
        }
      }
    }

    // 4. Salvage truncated array
    if (!parsed) {
      const start = cleaned.indexOf('[');
      if (start !== -1) {
        let lastBrace = cleaned.lastIndexOf('}');
        while (lastBrace > start) {
          try {
            const candidate = cleaned.substring(start, lastBrace + 1) + ']';
            const candidateParsed = JSON.parse(candidate);
            if (Array.isArray(candidateParsed)) {
              parsed = candidateParsed;
              break;
            }
          } catch {
            lastBrace = cleaned.lastIndexOf('}', lastBrace - 1);
          }
        }
      }
    }

    const items = Array.isArray(parsed)
      ? parsed
      : (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).findings))
        ? (parsed as any).findings
        : [];

    return items.map((p: any) => ({
      file:       String(p.file || ''),
      line:       Number(p.line || 0),
      dimension: (p.dimension && ['bugs', 'security', 'tests', 'optimisation'].includes(p.dimension)) ? p.dimension : dimension,
      severity:   p.severity || 'medium',
      message:    String(p.message || p.description || p.title || ''),
      confidence: Math.max(0, Math.min(1, Number(p.confidence || 0.8))),
      suggestion: p.suggestion ? String(p.suggestion) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Simple chunker mirrored from CLI (max 3 typical files per chunk)
 */
function chunkDiffs(diffs: FileDiff[]): FileDiff[][] {
  const chunks: FileDiff[][] = [];
  let currentChunk: FileDiff[] = [];
  
  for (const diff of diffs) {
    currentChunk.push(diff);
    if (currentChunk.length >= 3) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

/**
 * Simple deduplicator
 */
function deduplicateFindings(findings: Finding[]): Finding[] {
  const map = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.file}:${f.line}:${f.dimension}`;
    const existing = map.get(key);
    if (!existing || f.confidence > existing.confidence) {
      map.set(key, f);
    }
  }
  return Array.from(map.values());
}
