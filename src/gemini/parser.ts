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

export function parseFindings(rawJson: string, dimension: Dimension): Finding[] {
  try {
    const parsed = JSON.parse(rawJson);

    if (!Array.isArray(parsed)) {
      logger.warn(`Expected JSON array from Gemini for ${dimension}, got ${typeof parsed}`);
      return [];
    }

    const findings: Finding[] = [];

    for (const item of parsed) {
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
      let confidence = record.confidence as number;
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
    logger.warn(
      `Failed to parse Gemini JSON response for ${dimension}: ${error.message}`,
    );
    return [];
  }
}
