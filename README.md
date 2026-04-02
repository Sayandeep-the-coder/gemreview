# GemReview 🤖

> AI-powered PR review bot for the terminal. Powered by Google Gemini.

[![npm version](https://img.shields.io/npm/v/gemreview)](https://www.npmjs.com/package/gemreview)
[![npm downloads](https://img.shields.io/npm/dm/gemreview)](https://www.npmjs.com/package/gemreview)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

GemReview analyses your GitHub pull requests using Gemini AI and posts **inline comments** + a **structured summary** — covering code quality, security, test coverage, and performance optimisation. Runs entirely from your terminal. No server. No CI setup required.

---

## Features

- 🐛 **Bug detection** — logic errors, null dereferences, bad error handling
- 🔒 **Security scanning** — injections, hardcoded secrets, missing auth checks
- 🧪 **Test coverage gaps** — missing tests for new code, untested edge cases
- ⚡ **Optimisation hints** — algorithmic complexity, N+1 queries, memory leaks
- 💬 **Inline PR comments** — posted per finding, anchored to the exact line
- 📋 **Summary comment** — severity table posted to the PR thread
- 🌐 **Multi-language** — works with any language in your diff
- 🔧 **Config file** — per-repo `.gemreview.json` for team-wide settings
- 🧪 **Dry-run mode** — preview output in terminal before posting

---

## Requirements

- Node.js ≥ 18
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A GitHub Personal Access Token with `repo` scope

---

## Installation

```bash
npm install -g gemreview
```

Or run without installing:
```bash
npx gemreview init
```

---

## Quick Start

### 1. Initialise

```bash
gemreview init
```

GemReview will prompt you interactively in the terminal:

```
$ gemreview init

Welcome to GemReview 🤖
─────────────────────────────────────────

? Enter your Gemini API key:  ********************************
  ↳ Get one free at https://aistudio.google.com/app/apikey
  ↳ Stored in ~/.gemreview/config.json (chmod 600 — readable only by you)

? Enter your GitHub Personal Access Token:  ********************************
  ↳ Needs `repo` scope — https://github.com/settings/tokens
  ↳ Stored in ~/.gemreview/config.json (chmod 600)

? Default Gemini model:
  ❯ gemini-2.5-pro  (higher quality, slower)
    gemini-2.0-flash  (faster, lower cost)

✅ Config saved to ~/.gemreview/config.json
   Run `gemreview run --pr <url>` to review your first PR.
```

**Your API key is:**
- Typed directly into your terminal (input is masked with `*`)
- Never sent anywhere except directly to `generativelanguage.googleapis.com`
- Stored locally at `~/.gemreview/config.json` with `600` permissions (only your user can read it)
- Never logged, printed in errors, or included in any output

### 2. Review a PR

```bash
gemreview run --pr https://github.com/your-org/your-repo/pull/42
```

That's it. GemReview will:
1. Fetch the PR diff from GitHub
2. Send it to Gemini in structured chunks
3. Post inline comments for each finding
4. Post a summary comment to the PR thread
5. Print a results summary to your terminal

## GitHub Actions Integration

Add GemReview to any GitHub repo in 2 steps — no CLI setup required.

### Step 1 — Add your Gemini API key as a secret

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

```
Name:  GEMINI_API_KEY
Value: AIzaSy...   (your Gemini API key from aistudio.google.com)
```

### Step 2 — Create the workflow file

Create `.github/workflows/gemreview.yml` in your repo:

```yaml
name: GemReview

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write   # required to post inline comments

    steps:
      - uses: Sayandeep-the-coder/gemreview@v1
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

That's it. Every PR in your repo now gets an automatic AI review.

### Action Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `gemini-api-key` | required | Your Gemini API key (use a secret) |
| `github-token` | auto | Provided by GitHub — no action needed |
| `dimensions` | all 4 | `bugs,security,tests,optimisation` |
| `severity-threshold` | `medium` | Minimum severity to post as a comment |
| `max-inline-comments` | `20` | Cap on inline comments per review |
| `fail-on-severity` | off | Fail the CI check at this severity level |
| `skip-draft-prs` | `true` | Skip draft PRs |
| `skip-bots` | `true` | Skip bot-authored PRs (e.g. Dependabot) |
| `post-prompt` | `false` | Post AI fix prompt as a PR comment |
| `dry-run` | `false` | Review without posting any comments |

### Block merges on critical findings

```yaml
- uses: Sayandeep-the-coder/gemreview@v1
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    fail-on-severity: critical   # PR cannot merge if critical finding found
```

### Security note

Your Gemini API key is stored in **your own repo's secrets**.
GemReview never receives, stores, or logs your key.
It passes directly from your secrets to the Gemini API at runtime.

---

## Usage

```
Usage: gemreview <command> [options]

Commands:
  init                     Interactive setup (API keys, default config)
  run                      Run a review on a GitHub PR
  config show              Display current global config
  config set <key> <val>   Update a config value

Options for `run`:
  --pr <url>               GitHub PR URL (required)
  --dry-run                Print findings to terminal, do not post to GitHub
  --dimensions <list>      Comma-separated: bugs,security,tests,optimisation
  --severity <level>       Minimum severity to post: low|medium|high|critical
  --verbose                Debug output
  --no-inline              Skip inline comments, post summary only
  --no-summary             Skip summary comment, post inline comments only
  --prompt                 Generate an AI agent prompt to fix all findings (printed to stdout)
  --prompt-output <path>   Save the agent prompt to a file instead of printing
  -h, --help               Show help
```

### Examples

```bash
# Full review
gemreview run --pr https://github.com/acme/api/pull/88

# Dry run — preview output in terminal only
gemreview run --pr https://github.com/acme/api/pull/88 --dry-run

# Only run security and bug checks
gemreview run --pr https://github.com/acme/api/pull/88 --dimensions bugs,security

# Only surface high/critical findings
gemreview run --pr https://github.com/acme/api/pull/88 --severity high

# Summary comment only (no inline noise)
gemreview run --pr https://github.com/acme/api/pull/88 --no-inline

# Generate an AI agent fix prompt and print it to the terminal
gemreview run --pr https://github.com/acme/api/pull/88 --prompt

# Save the agent prompt to a file to paste into your editor
gemreview run --pr https://github.com/acme/api/pull/88 --prompt --prompt-output fix-prompt.md

# Review + post comments to GitHub AND generate the agent prompt
gemreview run --pr https://github.com/acme/api/pull/88 --prompt
```

---

## Configuration

Create a `.gemreview.json` in your project root to customise behaviour per repo:

```json
{
  "dimensions": ["bugs", "security", "tests", "optimisation"],
  "severity_threshold": "medium",
  "max_inline_comments": 20,
  "exclude_paths": ["*.lock", "dist/**", "*.min.js", "*.generated.*"],
  "summary_comment": true,
  "inline_comments": true,
  "model": "gemini-2.5-pro"
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `dimensions` | `string[]` | all 4 | Which review dimensions to run |
| `severity_threshold` | `string` | `"medium"` | Minimum severity for inline comments |
| `max_inline_comments` | `number` | `20` | Cap on total inline comments per review |
| `exclude_paths` | `string[]` | `[]` | Glob patterns to skip |
| `summary_comment` | `boolean` | `true` | Post a summary comment to the PR |
| `inline_comments` | `boolean` | `true` | Post inline comments per finding |
| `model` | `string` | `"gemini-2.5-pro"` | Gemini model to use |

### Global Config (API Keys)

Your Gemini API key and GitHub token are stored separately in `~/.gemreview/config.json`, created automatically by `gemreview init`. This file lives in your home directory — never inside a repo — so it can't be accidentally committed.

```json
{
  "gemini_api_key": "AIzaSy...",
  "github_token": "ghp_...",
  "github_base_url": "https://api.github.com"
}
```

You can also set or rotate keys directly from the terminal at any time:

```bash
gemreview config set gemini_api_key AIzaSy...
gemreview config set github_token ghp_...
```

Or bypass file storage entirely using environment variables:

```bash
export GEMREVIEW_GEMINI_KEY=AIzaSy...
export GEMREVIEW_GITHUB_TOKEN=ghp_...
gemreview run --pr <url>
```

**Precedence (highest → lowest):** env vars → `~/.gemreview/config.json` → defaults

---

## Output

### Inline Comment Example

```
[GemReview 🤖] SECURITY | HIGH

Hardcoded API key detected. Secrets committed to source control are a
critical security risk. Use environment variables or a secrets manager.

Suggested fix: const apiKey = process.env.STRIPE_API_KEY;
```

### Summary Comment Example

```
## GemReview Summary 🤖

PR: Add payment processing flow
Reviewed: 6 files, 289 lines changed
Model: gemini-2.5-pro | Duration: 12s

| Dimension       | Findings | Critical | High | Medium | Low |
|-----------------|----------|----------|------|--------|-----|
| 🐛 Code Quality | 3        | 0        | 1    | 2      | 0   |
| 🔒 Security     | 2        | 1        | 1    | 0      | 0   |
| 🧪 Test Coverage| 3        | 0        | 1    | 2      | 0   |
| ⚡ Optimisation  | 4        | 0        | 0    | 2      | 2   |

Overall Risk: 🔴 HIGH — 1 critical finding requires attention before merge.
```

---

## Project Structure

```
gemreview/
├── src/
│   ├── cli/              # CLI entry point and command definitions
│   ├── github/           # GitHub API client (fetch diff, post comments)
│   ├── gemini/           # Gemini API client + prompt templates
│   ├── review/           # Review orchestration and dimension runners
│   ├── config/           # Config loading and validation
│   └── output/           # Terminal formatting, spinner, colour output
├── prompts/              # Gemini prompt templates (per dimension)
├── tests/                # Unit + integration tests
├── .gemreview.json       # Example project config
├── ARCHITECTURE.md       # System design and data flow
├── CONTRIBUTING.md       # How to contribute
└── PRD.md                # Product Requirements Document
```

---

## Privacy & Security

- Your code is sent to Google Gemini's API for analysis. Review [Google's data policy](https://ai.google.dev/gemini-api/terms).
- API keys are stored locally in `~/.gemreview/config.json` with `600` permissions.
- Keys are never logged, printed, or included in error output.
- Use `--dry-run` to avoid any write calls to GitHub.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the dev environment, run tests, and submit PRs.

---

## License

MIT © 2026
