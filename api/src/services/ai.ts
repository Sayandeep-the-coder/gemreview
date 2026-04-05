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

/**
 * Backend AI Service for performing Gemini reviews.
 */
export async function runServerReview(
  apiKey: string,
  modelName: string,
  dimensions: Dimension[],
  diffs: FileDiff[]
): Promise<Finding[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const chunks = chunkDiffs(diffs);
  const allFindings: Finding[] = [];

  // For each dimension and chunk, run analysis
  for (const dimension of dimensions) {
    for (const chunk of chunks) {
      const diffContent = chunk
        .map((file) => `--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`)
        .join('\n\n');

      const { system, user } = buildPrompt(dimension, diffContent);
      
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
          },
        });

        const response = result.response.text();
        const findings = parseFindings(response, dimension);
        allFindings.push(...findings);
      } catch (err: any) {
        console.error(`[AI] Error analyzing ${dimension} in chunk:`, err.message);
      }
    }
  }

  return deduplicateFindings(allFindings);
}

/**
 * Simplified prompt builder mirrored from CLI
 */
function buildPrompt(dimension: Dimension, diff: string) {
  const system = `You are GemReview, a world-class AI code reviewer.
Focus strictly on: ${dimension.toUpperCase()}.
Output MUST be valid JSON (no markdown blocks).
JSON structure: Array<{ file: string, line: number, severity: 'low'|'medium'|'high'|'critical', message: string, confidence: number }>
Only report real issues. If no issues, return [].`;

  const user = `Analyse this diff for ${dimension}:\n\n${diff}`;
  return { system, user };
}

/**
 * Simple finding parser mirrored from CLI
 */
function parseFindings(raw: string, dimension: Dimension): Finding[] {
  try {
    // Clean up markdown code blocks if any
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    if (!Array.isArray(parsed)) return [];

    return parsed.map((p: any) => ({
      file:       String(p.file || ''),
      line:       Number(p.line || 0),
      dimension,
      severity:   p.severity || 'medium',
      message:    String(p.message || ''),
      confidence: Number(p.confidence || 0.8),
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
