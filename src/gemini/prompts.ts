import * as fs from 'node:fs';
import * as path from 'node:path';

export type Dimension = 'bugs' | 'security' | 'tests' | 'optimisation';

export const DIMENSION_EMOJIS: Record<Dimension, string> = {
  bugs: '🐛',
  security: '🔒',
  tests: '🧪',
  optimisation: '⚡',
};

function getPromptsDir(): string {
  // Look for prompts directory relative to the project root
  // When running from dist/, go up one level
  const candidates = [
    path.join(process.cwd(), 'prompts'),
    path.join(__dirname, '..', '..', 'prompts'),
    path.join(__dirname, '..', 'prompts'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  throw new Error('Could not find prompts/ directory. Make sure you are running from the project root.');
}

let cachedSystemPrompt: string | null = null;
const cachedDimensionPrompts: Record<string, string> = {};

function loadSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const promptsDir = getPromptsDir();
  cachedSystemPrompt = fs.readFileSync(path.join(promptsDir, 'system.txt'), 'utf-8');
  return cachedSystemPrompt;
}

function loadDimensionPrompt(dimension: Dimension): string {
  if (cachedDimensionPrompts[dimension]) return cachedDimensionPrompts[dimension];
  const promptsDir = getPromptsDir();
  const promptFile = path.join(promptsDir, `${dimension}.txt`);
  cachedDimensionPrompts[dimension] = fs.readFileSync(promptFile, 'utf-8');
  return cachedDimensionPrompts[dimension];
}

export function buildPrompt(
  dimension: Dimension,
  diffContent: string,
): { system: string; user: string } {
  const system = loadSystemPrompt();
  const dimensionTemplate = loadDimensionPrompt(dimension);
  const user = dimensionTemplate.replace('{DIFF_CONTENT}', diffContent);
  return { system, user };
}
