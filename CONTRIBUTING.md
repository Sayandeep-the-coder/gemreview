# Contributing to GemReview

Welcome to GemReview! This project is a TypeScript CLI tool that uses Google Gemini AI to review GitHub Pull Requests. Your contributions help make automated code reviews more effective for everyone.

Check out open issues labeled [good first issue](https://github.com/Sayandeep-the-coder/gemreview/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) and [help wanted](https://github.com/Sayandeep-the-coder/gemreview/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22). We value bug reports, feature requests, and documentation improvements alongside code contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Dev Environment Setup](#dev-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Adding a New Review Dimension](#adding-a-new-review-dimension)
- [Modifying Gemini Prompts](#modifying-gemini-prompts)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting a Feature](#requesting-a-feature)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Code Style Reference](#code-style-reference)
- [Questions?](#questions?)

## Code of Conduct

We are committed to providing a respectful collaboration environment. This project does not tolerate harassment and requires all contributors to provide constructive feedback. We follow the Contributor Covenant v2.1. Read the full text in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Prerequisites

Verify you have the following versions installed:
- Node.js ≥ 18 (Run `node --version`)
- npm ≥ 9 (Run `npm --version`)
- Git ≥ 2.34

You must also obtain:
- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
- A **GitHub Personal Access Token** with `repo` scope

## Dev Environment Setup

1. Fork the repository on GitHub and clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/gemreview.git
```

2. Navigate into the project directory:
```bash
cd gemreview
```

3. Install dependencies:
```bash
npm install
```

4. Create your environment file from the template:
```bash
cp .env.example .env
```
Fill in your `GEMREVIEW_GEMINI_KEY` and `GEMREVIEW_GITHUB_TOKEN` in the **.env** file.

5. Build the project:
```bash
npm run build
```

6. Link the package globally:
```bash
npm link
```

7. Verify the installation:
```bash
gemreview --version
```

8. Run the test suite:
```bash
npm test
```

> **Tip:** Use `npm run dev` during development. It watches for file changes and recompiles automatically, removing the need to run `npm run build` after every edit.

### Running the API Locally (Docker)

If you need to test the GemReview API backend locally during development:
1. Copy `api/.env.example` to `api/.env` and fill it out.
2. Build and run via Docker:
```bash
cd api
docker build -t gemreview-api .
docker run -d --name gemreview-api -p 3001:3001 --env-file .env gemreview-api
docker logs -f gemreview-api
```

## Project Structure

```
gemreview/
├── src/
│   ├── cli/           # CLI commands — entry point, run, init, config
│   ├── github/        # GitHub REST API client — fetch diff, post comments
│   ├── gemini/        # Gemini AI client, prompts, response parser, retry logic
│   ├── review/        # Review pipeline — orchestrator, chunker, filter, dimensions
│   ├── config/        # Config loading, Zod schemas, defaults
│   └── output/        # Terminal rendering — spinner, logger, tables, dry-run
├── prompts/           # Gemini prompt templates (one .txt per dimension)
├── tests/
│   ├── unit/          # Pure unit tests — no network calls
│   ├── integration/   # API mocks using MSW
│   └── fixtures/      # Sample diffs and Gemini JSON responses
├── .gemreview.json    # Example project-level config (committed)
└── .env.example       # Environment variable template (never commit .env)
```

## Development Workflow

### Branching

Branch from **main** and use descriptive prefixes:
- `feat/short-description` (e.g., `feat/gemini-streaming`)
- `fix/issue-number-short-description` (e.g., `fix/142-null-patch-crash`)
- `docs/what-you-changed`
- `test/what-you-tested`
- `chore/what-you-did`

### Making Changes

Write code in **TypeScript** using strict mode. Avoid using `any` types. Run `npm run lint` and `npm run format` before you commit. Write a unit test for every new exported function and a regression test for every bug fix.

### Commit Messages

Follow **Conventional Commits** for all commit messages.

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature visible to users |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `test:` | Adding or updating tests |
| `refactor:` | Code change that's not a feature or fix |
| `chore:` | Dependency updates, config changes, build tooling |
| `perf:` | Performance improvement |

**Good examples:**
- `feat: add support for streaming Gemini responses`
- `fix: handle empty diffs in PR fetcher`
- `docs: update setup instructions for Windows`
- `test: add unit tests for the prompt parser`
- `chore: update @octokit/rest to v20`

**Bad examples:**
- `fixed bug` (Missing prefix and description)
- `feat: update things` (Vague description)
- `chore: changed CSS and added a button` (Mixed types and non-conventional)

### Running Locally Against a Real PR

Test your changes against a real Pull Request:
```bash
gemreview run --pr https://github.com/your-org/your-repo/pull/1 --dry-run
```
Always use the `--dry-run` flag during development to prevent comments from being posted to GitHub.

## Testing

### Running Tests

Run the following commands to execute different parts of the test suite:

```bash
npm test                    # Run all tests
npm run test:unit           # Run unit tests only
npm run test:integration    # Run integration tests only
npm run test:watch          # Enter watch mode
npm run test:coverage       # Generate coverage report
```

### Test Structure Rules

Separate your tests according to their scope:
- **Unit tests**: Test pure functions without using the filesystem, network, Gemini, or GitHub.
- **Integration tests**: Use **MSW** to mock GitHub and Gemini APIs. Do not make real network calls.
- **Fixtures**: Store sample diffs and Gemini JSON responses in **tests/fixtures/**. Add new fixtures when you introduce new test scenarios.
- **File mirroring**: Ensure each test file mirrors its source file. For example, `src/gemini/parser.ts` must have a corresponding test at `tests/unit/parser.test.ts`.

### Coverage Requirements

Maintain high test quality:
- Do not reduce overall coverage below the current level.
- Write at least one test for every new exported function.
- Include a regression test for every bug fix.

### Adding a Fixture

Follow these steps to add a new Gemini response fixture:
1. Create a sample diff in **tests/fixtures/diffs/**.
2. Run an actual Gemini API call once in your development environment.
3. Save the raw JSON response to **tests/fixtures/gemini-responses/**.
4. Use this fixture in your tests instead of calling the real API.

## Adding a New Review Dimension

Follow this guide to add a new review dimension:

1. Create **src/review/dimensions/your-dimension.ts** and export `DIMENSION_NAME` and `DIMENSION_LABEL`.
2. Create **prompts/your-dimension.txt** following the format in **PROMPTS.md**.
3. Register your dimension in **src/review/orchestrator.ts**.
4. Add your dimension to the `Dimension` type union in **src/gemini/parser.ts**.
5. Add your dimension to `PROJECT_DEFAULTS.dimensions` in **src/config/defaults.ts**.
6. Add a fixture response in **tests/fixtures/gemini-responses/your-dimension.json**.
7. Write unit tests in **tests/unit/**.
8. Update the **README.md** features list and usage table.
9. Update **PROMPTS.md** with your new prompt template and design rationale.

## Modifying Gemini Prompts

Changes to files in **prompts/** affect review quality for all users. Perform these steps before submitting a prompt change:

1. Test your change against at least 3 different real diffs in different languages.
2. Document the difference in finding quality in your PR description.
3. Update **PROMPTS.md** with the new template and an explanation of the change.
4. Update relevant fixtures if the change alters the structure of finding responses.

## Submitting a Pull Request

### Before Opening a PR

Verify your changes against this checklist:

- [ ] My branch is up to date with main
- [ ] `npm test` passes with no failures
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` succeeds
- [ ] New code has tests
- [ ] Bug fixes include a regression test
- [ ] README/docs updated if behaviour changed
- [ ] No API keys, tokens, or secrets anywhere in the diff
- [ ] Commit messages follow Conventional Commits

### PR Title

Format your PR title using Conventional Commits: `feat: add streaming support for large diffs`

### PR Description Template

Copy and fill out this template in your PR description:

```markdown
## What does this PR do?
<!-- One paragraph summary -->

## Why?
<!-- The problem this solves or the user need it addresses -->

## How to test it
<!-- Steps a reviewer can follow to test the change manually -->
gemreview run --pr <url> --dry-run

## Screenshots / output
<!-- Paste terminal output if the change affects CLI output -->

## Checklist
- [ ] Tests added / updated
- [ ] Docs updated
- [ ] No secrets in diff
```

### Review Process

Merge requests require at least 1 approval. All CI checks, including linting, testing, and building, must pass. Respond to all inline comments before you request a re-review. Your PR will be squash-merged into **main**, with the PR title serving as the final commit message.

## Reporting Bugs

Include the following information in your bug report:

```
**GemReview version:** 1.0.2
**Node.js version:** 20.11.0
**OS:** macOS 14.3 (Apple Silicon)

**Command run:**
gemreview run --pr https://github.com/acme/api/pull/88 --verbose

**Expected behaviour:**
Review completes and posts comments to the PR.

**Actual behaviour:**
Crashes with: TypeError: Cannot read properties of undefined (reading 'patch')

**Stack trace:**
<paste here>

**PR details (if shareable):**
6 files, 120 lines changed, all TypeScript
```

## Requesting a Feature

Follow these guidelines for feature requests:
- Describe the problem you want to solve instead of just the solution.
- Explain who benefits from this feature (e.g., solo devs, team leads, large teams).
- State if you are willing to implement the feature yourself.
- Use the **enhancement** label on GitHub Issues.

## Security Vulnerabilities

Do not open a public GitHub Issue for security vulnerabilities. Email **security@your-org.com** with the subject: `[GemReview] Security: <short description>`. Include the affected version, reproduction steps, and potential impact. We follow a 90-day responsible disclosure policy and acknowledge receipts within 48 hours.

## Code Style Reference

Follow these TypeScript patterns in your contributions:

| ❌ Don't | ✅ Do |
|---------|-------|
| `const x: any = ...` | `const x: unknown = ...; if (typeof x === 'string') { ... }` |
| Silent catch: `catch (e) {}` | `catch (e) { log.warn('Failed to X', e); }` |
| `Promise.all([...])` for Gemini calls | `runWithConcurrencyLimit([...], 2)` |
| Hardcoding a delay: `setTimeout(fn, 2000)` | Use `withRetry()` from **src/gemini/retry.ts** |
| Log raw error object: `console.log(err)` | `log.error('Context message', maskKeys(String(err), [apiKey]))` |
| `export default function` | Named exports only: `export function myFn()` |

## Questions?

- General questions: [GitHub Discussions](https://github.com/Sayandeep-the-coder/gemreview/discussions)
- Bug reports: [GitHub Issues](https://github.com/Sayandeep-the-coder/gemreview/issues)
- Security: email security@your-org.com
