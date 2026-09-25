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
  const content = fs.readFileSync(path.join(promptsDir, 'system.txt'), 'utf-8');
  cachedSystemPrompt = content;
  return content;
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

/**
 * Builds a unified prompt that reviews all requested dimensions simultaneously in a single pass.
 * This reduces API round-trips by up to 75% and ensures lightning-fast execution without hitting rate limits.
 */
export function buildUnifiedPrompt(
  dimensions: Dimension[],
  diffContent: string,
): { system: string; user: string } {
  if (dimensions.length === 1) {
    return buildPrompt(dimensions[0], diffContent);
  }

  const system = loadSystemPrompt();

  const dimensionPrompts: Record<Dimension, string> = {
    bugs: `• BUGS AND CODE QUALITY:
  - Null / undefined dereferences and missing null checks
  - Off-by-one errors in loops or array access
  - Incorrect or swallowed error handling (empty catch blocks, silent failures)
  - Unreachable code or impossible conditions
  - Race conditions or missing synchronisation in async code
  - Incorrect type usage or implicit coercions that could cause runtime errors
  - Boolean logic errors (flipped conditions, missing negation)
  - Resource leaks (open file handles, unclosed connections, dangling timers)`,
    security: `• SECURITY VULNERABILITIES:
  - Injection flaws (SQL, command, template, LDAP, path traversal)
  - XSS (Cross-Site Scripting) via unsanitised user input in rendered HTML
  - Hardcoded secrets, API keys, passwords, private tokens
  - Broken authentication or missing authorisation checks
  - Insecure cryptographic operations (weak algorithms, broken PRNGs)
  - CSRF vulnerabilities or missing origin/referer validation
  - Insecure deserialization or eval-like constructs
  - SSRF (Server-Side Request Forgery) via unvalidated external URLs`,
    tests: `• TEST COVERAGE AND TEST QUALITY:
  - Critical paths or core business logic added without corresponding tests
  - Missing unit tests for newly exported functions, classes, or modules
  - Edge cases not covered by new tests (null/empty inputs, boundary values, error conditions)
  - Fragile or non-deterministic tests (relying on timing, external network, shared state)
  - Tests that assert trivial conditions rather than actual behaviour
  - Missing integration tests for new API endpoints or database interactions`,
    optimisation: `• PERFORMANCE AND OPTIMISATION:
  - Unnecessary O(n²) or worse algorithmic complexity where O(n) or O(n log n) is feasible
  - N+1 query patterns (looping database calls, repeated API requests)
  - Memory leaks (unbounded caches, retained event listeners, circular references)
  - Redundant or duplicate computations that should be memoised or hoisted
  - Missing pagination or streaming on unbounded collections / datasets
  - Inefficient string concatenation in loops or heavy allocations in hot paths`,
  };

  const sections = dimensions
    .filter((d) => dimensionPrompts[d])
    .map((d) => dimensionPrompts[d])
    .join('\n\n');

  const allowedDims = dimensions.map((d) => `'${d}'`).join(' | ');

  const user = `Perform a comprehensive multi-dimension code review on the unified diff below.
Review simultaneously for all of the following dimensions:

${sections}

Do NOT report style issues, missing comments, or formatting problems.
Only report real, significant issues clearly visible in the diff.

IMPORTANT: For every finding in your JSON output, set the "dimension" field to the exact dimension it belongs to: ${allowedDims}.
Output ONLY a valid JSON array conforming to the schema in the system prompt. Return [] if no issues found.

<diff>
${diffContent}
</diff>`;

  return { system, user };
}
