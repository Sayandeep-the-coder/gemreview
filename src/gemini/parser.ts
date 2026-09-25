import * as logger from '../output/logger.js';

export type Dimension = 'bugs' | 'security' | 'tests' | 'optimisation';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  file: string;
  line: number;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  suggestion?: string;
  confidence: number;
}

const VALID_DIMENSIONS: Set<string> = new Set([
  'bugs',
  'security',
  'tests',
  'optimisation',
]);
const VALID_SEVERITIES: Set<string> = new Set([
  'low',
  'medium',
  'high',
  'critical',
]);

function isValidFinding(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  return (
    typeof record.file === 'string' &&
    typeof record.line === 'number' &&
    typeof record.dimension === 'string' &&
    typeof record.severity === 'string' &&
    typeof record.title === 'string' &&
    typeof record.description === 'string' &&
    typeof record.confidence === 'number'
  );
}

/**
 * Repairs a JSON array that was cut off / truncated mid-stream by Gemini token limit.
 * Searches backwards for the last valid completed object '}' and closes the array with ']'.
 */
export function repairTruncatedJsonArray(raw: string): unknown[] | null {
  const startIdx = raw.indexOf('[');
  if (startIdx === -1) return null;

  const arrayStr = raw.substring(startIdx);

  // Check if there is already a closing bracket ']' that parses
  const lastBracket = arrayStr.lastIndexOf(']');
  if (lastBracket > 0) {
    try {
      const parsed = JSON.parse(arrayStr.substring(0, lastBracket + 1));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to brace repair
    }
  }

  let lastBrace = arrayStr.lastIndexOf('}');

  while (lastBrace > 0) {
    const candidate = arrayStr.substring(0, lastBrace + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Step backwards to the previous closing brace '}'
      lastBrace = arrayStr.lastIndexOf('}', lastBrace - 1);
    }
  }

  return null;
}

export function parseFindings(rawJson: string, dimension?: Dimension): Finding[] {
  try {
    const cleaned = rawJson.trim();

    // Helper to extract finding items from any parsed JSON (array or wrapper object)
    const extractArrayFromValue = (val: unknown): unknown[] | null => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const candidate =
          obj.findings ||
          (dimension ? obj[dimension] : null) ||
          obj.bugs ||
          obj.issues ||
          obj.results ||
          obj.items ||
          obj.data;
        if (Array.isArray(candidate)) return candidate;
        if (Object.keys(obj).length === 0) return [];
      }
      return null;
    };

    let items: unknown[] | null = null;

    // 1. Look for markdown code blocks (```json ... ``` or ``` ... ```) in reverse order
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
    let blockMatch: RegExpExecArray | null;
    const codeBlockCandidates: string[] = [];
    while ((blockMatch = codeBlockRegex.exec(cleaned)) !== null) {
      codeBlockCandidates.push(blockMatch[1].trim());
    }

    for (let i = codeBlockCandidates.length - 1; i >= 0; i--) {
      const candidate = codeBlockCandidates[i];
      try {
        const parsed = JSON.parse(candidate);
        const arr = extractArrayFromValue(parsed);
        if (arr !== null) {
          items = arr;
          break;
        }
      } catch {
        const salvaged = repairTruncatedJsonArray(candidate);
        if (salvaged !== null) {
          items = salvaged;
          break;
        }
      }
    }

    // 2. Direct JSON parse of cleaned string
    if (!items) {
      try {
        const parsed = JSON.parse(cleaned);
        const arr = extractArrayFromValue(parsed);
        if (arr !== null) items = arr;
      } catch {
        // Continue
      }
    }

    // 3. Extract between outermost brackets '[' and ']'
    if (!items) {
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        try {
          const parsed = JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          // Continue
        }
      }
    }

    // 4. Extract between outermost braces '{' and '}'
    if (!items) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
          const arr = extractArrayFromValue(parsed);
          if (arr !== null) items = arr;
        } catch {
          // Continue
        }
      }
    }

    // 5. Try truncation repair on partial array
    if (!items) {
      const salvaged = repairTruncatedJsonArray(cleaned);
      if (salvaged !== null) {
        items = salvaged;
      }
    }

    // 6. Conversational no-bugs / clean analysis
    if (!items) {
      const lower = cleaned.toLowerCase();
      if (
        lower.includes('no bug') ||
        lower.includes('no issue') ||
        lower.includes('no finding') ||
        lower.includes('no vulnerabilities') ||
        lower.includes('clean') ||
        lower.includes('looks good') ||
        lower.includes('no code quality issue') ||
        lower.includes('did not find any') ||
        lower.includes('syntactically correct') ||
        lower.includes('no obvious')
      ) {
        return [];
      }

      // If we still found no valid findings array, return empty without warning
      logger.debug(`No structured findings array in Gemini response for ${dimension}`);
      return [];
    }

    const findings: Finding[] = [];

    for (const item of items) {
      if (!isValidFinding(item)) {
        logger.debug(`Skipping malformed finding in ${dimension}: missing required fields`);
        continue;
      }

      const record = item as Record<string, unknown>;

      // Validate dimension
      if (!VALID_DIMENSIONS.has(record.dimension as string)) {
        logger.debug(`Skipping finding with invalid dimension: ${record.dimension}`);
        continue;
      }

      // Validate severity
      if (!VALID_SEVERITIES.has(record.severity as string)) {
        logger.debug(`Skipping finding with invalid severity: ${record.severity}`);
        continue;
      }

      // Clamp confidence to 0.0–1.0
      let confidence = typeof record.confidence === 'number' ? record.confidence : 0.8;
      confidence = Math.max(0, Math.min(1, confidence));

      findings.push({
        file: record.file as string,
        line: record.line as number,
        dimension: record.dimension as Dimension,
        severity: record.severity as Severity,
        title: record.title as string,
        description: record.description as string,
        suggestion: typeof record.suggestion === 'string' ? record.suggestion : undefined,
        confidence,
      });
    }

    return findings;
  } catch (error: any) {
    logger.debug(`Failed to parse Gemini JSON response for ${dimension}: ${error.message}`);
    return [];
  }
}
