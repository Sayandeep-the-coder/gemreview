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
- 👥 **Team Mode** — use shared organisation credits for reviews
- 🧪 **Dry-run mode** — preview output in terminal before posting

---

## Requirements

- Node.js ≥ 20
- **GitHub Personal Access Token** with `repo` scope (Mandatory for both modes)
- **Google Gemini API key** (Only for Personal Mode)

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

## Choosing Your Mode

GemReview v1.3.0 supports two ways to run AI code reviews. Choose the one that fits your workflow.

| Feature | **Personal Mode** | **Team Mode** |
|---------|-------------------|---------------|
| **API Key** | Your own (Google AI Studio) | Shared (managed by Org) |
| **Setup** | `gemreview init` | `gemreview auth login` |
| **Analysis** | Local (Direct to Google) | Remote (Via GemReview API) |
| **Privacy** | Code stays between you & Google | Code proxied via GemReview API |
| **Cost** | Uses your personal quota | Uses organization credits |
| **Ideal For** | Individual devs, private projects | Teams, open-source orgs |

---

## 🚀 Getting Started

### Option A: Personal Mode (Individual/Private)

Use your own [Google Gemini API key](https://aistudio.google.com/app/apikey). Your code and keys remain entirely local to your machine.

**1. Initialise**
```bash
gemreview init
```
*GemReview will prompt you interactively:*
```
$ gemreview init
Welcome to GemReview 🤖
─────────────────────────────────────────
? Enter your Gemini API key:  ********************************
  ↳ Stored in ~/.gemreview/config.json (chmod 600)
? Enter your GitHub Personal Access Token:  ********************************
  ↳ Stored in ~/.gemreview/config.json (chmod 600)
✅ Config saved!
```

**2. Review a PR**
```bash
gemreview run --pr <url>
```

---

### Option B: Team Mode (Organizations/Shared)

Perfect for teams. Sign in with GitHub to access your organisation's shared credits and shared Gemini API key. No personal API key required!

**1. Login via GitHub**
```bash
gemreview auth login
```

**2. Configure GitHub Token (Local access)**
Even in Team Mode, the CLI needs a token to read/write to your repositories locally.
```bash
gemreview config set github_token <your_github_pat>
```

**3. Select your Organisation**
```bash
gemreview org list      # see your memberships
gemreview org use <id>  # switch active context
```

**4. Review a PR**
```bash
gemreview run --pr <url>
```

---

## Team Mode Command Reference

| Command | Description |
|---------|-------------|
| `org create <name>` | Create a new organization |
| `org list` | List all organizations you belong to |
| `org use <slug>` | Set the active organization for reviews |
| `org usage` | View usage stats & remaining credits |
| `org set-gemini-key <key>` | (Admin) Set a shared Gemini API key for the org |
| **Members** | |
| `org members list` | List all members in the active org |
| `org members invite <id>`| Invite a member by GitHub login or email |
| `org members remove <id>`| (Admin) Remove a member from the org |
| **API Keys** | |
| `org keys list` | List your secret API keys for the org |
| `org keys create <name>`| Generate a new CLI API key |
| `org keys delete <id>` | Revoke an API key |
| **Invites** | |
| `org invites show <token>`| Look up invitation details |
| `org invites accept <token>`| Join an organization via invitation |


## How it Works

GemReview is designed for speed and security. Whether in Personal or Team mode, the workflow follows these steps:

1. **Fetch**: Connects to the GitHub API to fetch the PR metadata and file diffs.
2. **Filter**: Excludes any files matching your glob patterns in `.gemreview.json`.
3. **Analyze**: 
    - **Personal:** Sends structured chunks to Google Gemini directly.
    - **Team:** Sends diffs to the GemReview API for proxied analysis.
4. **Post**: Comments on the PR thread (inline + summary) via the octokit client.
5. **Report**: (Team Mode only) Usage is reported to your organization dashboard.

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
  auth login|logout|status GitHub authentication
  org create|list|use      Organisation management
  org members list|invite  Team member management

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
  "gemini_api_key": "AIzaSy...", # (Optional if using Team Mode)
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
├── api/                  # Hono-based proxy API for Team Mode
├── action/               # GitHub Actions standard workflow wrapper
├── prompts/              # Gemini prompt templates (per dimension)
├── tests/                # Unit + integration tests
├── .gemreview.json       # Example project config
├── ARCHITECTURE.md       # System design and data flow
├── CONTRIBUTING.md       # How to contribute
└── PRD.md                # Product Requirements Document
```

---

## Privacy & Security

> [!IMPORTANT]
> **GemReview is built with a security-first architecture. Your code and credentials are never stored permanently on our servers.**

- **Analysis Privacy:** Your code is sent to Google Gemini's API for analysis. Review [Google's data policy](https://ai.google.dev/gemini-api/terms).
- **Personal Mode:** The CLI communicates **directly** with Google. Your Gemimi API key stays on your machine.
- **Team Mode:** The CLI sends the diff to the GemReview API which proxies it to Gemini. We **do not store** your code beyond the life of the request.
- **Encrypted Org Keys:** Shared organization Gemini keys are encrypted at rest using **AES-256-GCM**.
- **Output Masking:** All API keys and tokens are automatically masked (`***`) in terminal output, logs, and error messages.
- **Local Security:** All configurations are stored in `~/.gemreview/config.json` with **`600` permissions** (restricted to your user only).
- **Dry-run:** Use `--dry-run` to preview findings without making any write calls to GitHub.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the dev environment, run tests, and submit PRs.

---

## License

MIT © 2026
