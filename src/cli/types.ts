import type { Dimension, Severity } from '../gemini/parser.js';

export interface RunOptions {
  pr: string;
  dryRun?: boolean;
  verbose?: boolean;
  dimensions?: Dimension[];
  severity?: Severity;
  model?: string;
  maxComments?: number;
  prompt: boolean;
  promptOutput?: string;
}
