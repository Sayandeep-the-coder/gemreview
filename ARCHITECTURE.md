# Architecture — GemReview CLI

**Version:** 1.0.0  
**Stack:** Node.js (TypeScript) · Google Gemini API · GitHub REST API

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer CLI                           │
│                  gemreview run --pr <url>                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLI Layer (src/cli/)                        │
│   - Parses args (commander.js)                                  │
│   - Loads config (global + project-level)                       │
│   - Renders terminal UI (ora spinner + chalk)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────┐       ┌─────────────────────────┐
│   GitHub Client     │       │     Config Manager      │
│   (src/github/)     │       │     (src/config/)       │
│                     │       │                         │
│  - Fetch PR meta    │       │  ~/.gemreview/config    │
│  - Fetch diff       │       │  .gemreview.json        │
│  - Post inline      │       │  CLI flag overrides     │
│    comments         │       └─────────────────────────┘
│  - Post summary     │
│    comment          │
└──────────┬──────────┘
           │ raw diff (patch)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Review Orchestrator (src/review/)              │
│                                                                 │
│  1. Parse diff → FileDiff[]                                     │
│  2. Filter excluded paths                                       │
│  3. Chunk files for context window management                   │
│  4. For each enabled dimension → call DimensionRunner           │
│  5. Merge + deduplicate findings                                │
│  6. Apply severity filter + comment cap                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ FileDiff chunks + dimension config
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gemini Client (src/gemini/)                   │
│                                                                 │
│  - Builds structured prompt (system + user)                     │
│  - Sends request to Gemini API                                  │
│  - Parses JSON response → Finding[]                             │
│  - Handles retries + rate limiting                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Breakdown

### 2.1 `src/cli/`
Entry point. Uses `commander.js` to define commands and parse flags.

```
cli/
├── index.ts        # Registers all commands
├── run.ts          # `gemreview run` command handler
├── init.ts         # `gemreview init` — masked terminal prompts for API key + GitHub token, writes ~/.gemreview/config.json with chmod 600
└── config.ts       # `gemreview config` subcommands
```

### 2.2 `src/github/`
GitHub REST API wrapper.

```
github/
├── client.ts       # Authenticated Axios instance
├── pr.ts           # Fetch PR metadata + file diffs
└── comments.ts     # Post inline + summary comments
```

Key types:
```typescript
interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  patch: string;           // raw unified diff
  additions: number;
  deletions: number;
}
```

### 2.3 `src/gemini/`
Gemini API integration.

```
gemini/
├── client.ts       # Gemini API wrapper (@google/generative-ai SDK)
├── prompts.ts      # Builds structured prompts per dimension
└── parser.ts       # Parses Gemini JSON response → Finding[]
```

Key types:
```typescript
interface Finding {
  file: string;
  line: number;            // line in the diff
  dimension: Dimension;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestion?: string;
  confidence: number;      // 0.0–1.0
}

type Dimension = 'bugs' | 'security' | 'tests' | 'optimisation';
```

### 2.4 `src/review/`
Orchestrates the full review pipeline.

```
review/
├── orchestrator.ts   # Main pipeline controller
├── chunker.ts        # Splits large diffs for context window
├── filter.ts         # Severity + path filtering
└── dimensions/
    ├── bugs.ts
    ├── security.ts
    ├── tests.ts
    └── optimisation.ts
```

### 2.5 `src/config/`
Config resolution with clear precedence.

```
config/
├── loader.ts       # Merges global + project + CLI flag configs
├── schema.ts       # Zod schema for validation
└── defaults.ts     # Default values
```

**Config precedence (highest → lowest):**
```
CLI flags > .gemreview.json > ~/.gemreview/config.json > defaults
```

### 2.6 `src/output/`
Terminal rendering.

```
output/
├── spinner.ts      # ora-based progress spinner
├── logger.ts       # chalk-coloured log levels
├── table.ts        # Summary table renderer
└── dryRun.ts       # Formats findings for terminal output
```

---

## 3. Data Flow

### 3.1 Full Review Run

```
1. CLI parses: `gemreview run --pr https://github.com/org/repo/pull/42`

2. Config loader resolves merged config

3. GitHub client:
   GET /repos/org/repo/pulls/42           → PR metadata
   GET /repos/org/repo/pulls/42/files     → FileDiff[]

4. Filter: Remove excluded paths (*.lock, dist/**, etc.)

5. Chunker: Group files into chunks ≤ 80,000 tokens each
   (Gemini 2.5 Pro context window: 1M tokens; we use conservative chunks
    to keep latency low and responses focused)

6. For each chunk × each enabled dimension:
   → Build structured prompt (see Prompts section)
   → POST to Gemini API
   → Parse JSON response → Finding[]

7. Merge all Finding[] arrays
   Deduplicate (same file + line + dimension)
   Apply severity_threshold filter
   Apply max_inline_comments cap (keep highest severity)

8. If inline_comments=true AND NOT dry-run:
   POST /repos/org/repo/pulls/42/comments  (per Finding)

9. If summary_comment=true AND NOT dry-run:
   POST /repos/org/repo/issues/42/comments  (summary)

10. Print terminal summary
```

### 3.2 Sequence Diagram

```
Developer       CLI          GitHub API        Gemini API
    │            │                │                 │
    │──run cmd──▶│                │                 │
    │            │──GET PR diff──▶│                 │
    │            │◀──FileDiff[]───│                 │
    │            │                │                 │
    │            │─────────── chunk + prompt ──────▶│
    │            │◀─────────── Finding[] JSON ───────│
    │            │                │                 │
    │            │──POST inline──▶│                 │
    │            │──POST summary─▶│                 │
    │            │                │                 │
    │◀─summary───│                │                 │
```

---

## 4. Gemini Prompt Design

Each dimension uses a two-part prompt: a **system prompt** (sets the role and output schema) and a **user prompt** (contains the actual diff).

### 4.1 System Prompt (shared)

```
You are an expert code reviewer. You will be given a unified diff of a
pull request. Analyse the diff and return findings ONLY as a JSON array.
Do not include any text outside the JSON array.

Each finding must match this schema:
{
  "file": string,         // filename from the diff
  "line": number,         // line number in the diff (right-hand side)
  "dimension": string,    // one of: bugs | security | tests | optimisation
  "severity": string,     // one of: low | medium | high | critical
  "title": string,        // short title (max 10 words)
  "description": string,  // explanation (max 100 words)
  "suggestion": string,   // concrete fix or improvement (optional)
  "confidence": number    // 0.0 to 1.0
}

Rules:
- Only report findings visible in the diff (added/modified lines)
- Do not flag removed lines
- Do not invent issues not present in the diff
- Return [] if there are no findings for the requested dimension
```

### 4.2 User Prompt (per dimension)

```
Dimension: SECURITY

Review the following diff for security vulnerabilities only.
Focus on: SQL/command/XSS injection, hardcoded secrets, missing input
validation, insecure auth checks, unsafe deserialization, CSRF exposure.

<diff>
{UNIFIED_DIFF_CONTENT}
</diff>
```

### 4.3 Context Window Management

| Model | Context window | Our chunk target |
|-------|---------------|-----------------|
| gemini-2.5-pro | 1,000,000 tokens | 80,000 tokens/chunk |
| gemini-2.0-flash | 1,000,000 tokens | 80,000 tokens/chunk |

For PRs > ~600 files: chunk by file groups and run in parallel with `Promise.allSettled`.

---

## 5. Error Handling Strategy

| Error Type | Handling |
|------------|---------|
| Gemini 429 (rate limit) | Exponential backoff: 1s → 2s → 4s → 8s (max 3 retries) |
| Gemini malformed JSON | Log warning, skip chunk, continue |
| GitHub 401 (bad token) | Surface clear auth error message, exit 1 |
| GitHub 404 (bad PR URL) | Validate URL format before making request |
| GitHub 403 (rate limit) | Check `X-RateLimit-Reset` header, wait or exit with message |
| Network timeout | 30s timeout per request; surface message |
| Invalid config | Zod schema validation at startup; show field-level errors |

---

## 6. Security Considerations

### API Key Collection

When the user runs `gemreview init`, the CLI collects the Gemini API key interactively:

```typescript
import { password } from '@inquirer/prompts';   // masked terminal input

const geminiKey = await password({
  message: 'Enter your Gemini API key:',
  mask: '*',
});
```

- `@inquirer/prompts` `password()` masks each character as `*` — the raw key is never echoed to the terminal
- The key is immediately written to `~/.gemreview/config.json` and the in-memory variable is not retained after that write
- If the user sets `GEMREVIEW_GEMINI_KEY` as an environment variable, `init` skips the prompt entirely and the key is never touched by GemReview at all — it is read directly from the process environment at call time

### Storage & Runtime Handling

- `~/.gemreview/config.json` created with `fs.writeFileSync` + `fs.chmodSync(path, 0o600)` — readable only by the current OS user
- A key-masking middleware wraps all log output: any string matching the key pattern is replaced with `[REDACTED]` before printing
- `--dry-run` flag is checked as the very first guard before ANY write operation (GitHub or otherwise)
- No analytics, telemetry, or phone-home calls of any kind
- All HTTP calls use HTTPS only; no HTTP fallback

---

## 7. Tech Stack

| Concern | Library | Reason |
|---------|---------|--------|
| CLI framework | `commander.js` | Lightweight, widely adopted |
| Terminal UI | `ora` + `chalk` | Spinner + colour without bloat |
| GitHub API | `@octokit/rest` | Official GitHub client |
| Gemini API | `@google/generative-ai` | Official Google SDK |
| Config validation | `zod` | Type-safe schema validation |
| Glob matching | `micromatch` | Fast glob for exclude_paths |
| Testing | `vitest` | Fast, native ESM support |
| Bundling | `tsup` | Zero-config TypeScript bundler |

---

## 8. Testing Strategy

```
tests/
├── unit/
│   ├── chunker.test.ts          # Diff chunking logic
│   ├── parser.test.ts           # Gemini JSON parsing + edge cases
│   ├── filter.test.ts           # Severity + path filtering
│   └── config.test.ts           # Config merging + precedence
├── integration/
│   ├── github.mock.test.ts      # GitHub API with MSW mocks
│   └── gemini.mock.test.ts      # Gemini API with fixture responses
└── fixtures/
    ├── diffs/                   # Sample unified diffs per language
    └── gemini-responses/        # Sample Gemini JSON responses
```

Run tests:
```bash
npm test          # unit + integration
npm run test:watch
npm run test:coverage
```
