import Link from "next/link";
import {
  Bot,
  Terminal,
  Users,
  Zap,
  Shield,
  Search,
  TestTube,
  ArrowRight,
  BookOpen,
  Code2,
  Settings,
  Github,
  ChevronRight,
  Sparkles,
  FileCode,
  KeyRound,
} from "lucide-react";

import { TerminalAnimation } from "@/components/docs/TerminalAnimation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GemReview Docs — AI-Powered PR Reviews",
  description:
    "Learn how to set up and use GemReview for AI-powered pull request reviews. Installation, CLI reference, GitHub Actions integration, and more.",
};

/* ─── tiny helpers ─────────────────────────────── */

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="group relative rounded-xl border border-border bg-[hsl(0_0%_6%)] overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <FileCode className="h-3.5 w-3.5" />
          {title}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed font-mono text-[hsl(0_0%_80%)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  title,
  subtitle,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="scroll-mt-24" id={id}>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
      )}
      <div className="mt-4 h-px bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_24px_-8px_hsl(262_100%_81%/0.12)]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── sidebar TOC items ────────────────────────── */
const toc = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "installation", label: "Installation", icon: Terminal },
  { id: "personal-mode", label: "Personal Mode", icon: KeyRound },
  { id: "team-mode", label: "Team Mode", icon: Users },
  { id: "cli-reference", label: "CLI Reference", icon: Code2 },
  { id: "github-actions", label: "GitHub Actions", icon: Github },
  { id: "configuration", label: "Configuration", icon: Settings },
  { id: "security", label: "Security & Privacy", icon: Shield },
  { id: "faq", label: "FAQ", icon: Sparkles },
];

/* ─── page ─────────────────────────────────────── */
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Top Bar ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <Bot className="h-6 w-6 text-primary transition-transform group-hover:rotate-12" />
            <span className="text-lg font-bold tracking-tight">GemReview</span>
            <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Docs
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Sayandeep-the-coder/gemreview"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Background glows */}
        <div className="absolute top-[-180px] left-[10%] h-[420px] w-[420px] bg-[radial-gradient(circle,hsl(262_100%_81%/0.07)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-[-120px] right-[5%] h-[360px] w-[360px] bg-[radial-gradient(circle,hsl(200_92%_59%/0.05)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative mx-auto max-w-[1400px] px-6 py-16 md:py-20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">
            {/* Left: text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> Documentation
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent max-w-2xl">
                Ship better code with AI&#8209;powered reviews
              </h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl leading-relaxed">
                GemReview analyses your GitHub pull requests using Google Gemini and
                posts inline comments &amp; a structured summary — covering code
                quality, security, test coverage, and performance.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#installation"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#cli-reference"
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-primary/30 transition-all"
                >
                  <Terminal className="h-4 w-4" />
                  CLI Reference
                </a>
              </div>
            </div>

            {/* Right: terminal animation */}
            <div className="hidden lg:block shrink-0 mt-10 lg:mt-0">
              <TerminalAnimation />
            </div>
          </div>

          {/* Feature cards row */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3">
            <FeatureCard
              icon={Search}
              title="Bug Detection"
              desc="Logic errors, null dereferences, bad error handling"
            />
            <FeatureCard
              icon={Shield}
              title="Security Scanning"
              desc="Injections, hardcoded secrets, missing auth checks"
            />
            <FeatureCard
              icon={TestTube}
              title="Test Coverage"
              desc="Missing tests for new code, untested edge cases"
            />
            <FeatureCard
              icon={Zap}
              title="Optimisation"
              desc="Algorithmic complexity, N+1 queries, memory leaks"
            />
          </div>
        </div>
      </section>

      {/* ─── Main Content ────────────────────────── */}
      <div className="mx-auto max-w-[1400px] flex relative justify-center gap-12">
        {/* Content */}
        <main className="flex-1 min-w-0 max-w-4xl px-4 md:px-8 py-12 space-y-16">
          {/* ── Overview ─────────────────────────── */}
          <section>
            <SectionHeading
              id="overview"
              icon={BookOpen}
              title="Overview"
              subtitle="What is GemReview and how does it work?"
            />
            <div className="mt-6 space-y-4 text-sm text-muted-foreground leading-relaxed max-w-3xl">
              <p>
                <strong className="text-foreground">GemReview</strong> is an
                AI-powered code review tool that analyses GitHub pull requests
                using Google Gemini. It catches bugs, security vulnerabilities,
                missing tests, and performance issues — then posts findings
                directly on your PR as inline comments.
              </p>
              <p>It works in two modes:</p>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2 text-foreground font-semibold text-sm">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Personal Mode
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Use your own Gemini API key. Code stays between you and
                    Google. Perfect for individual developers and private
                    projects.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2 text-foreground font-semibold text-sm">
                    <Users className="h-4 w-4 text-secondary" />
                    Team Mode
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Share a single org-managed API key with your team. Manage
                    credits, members, and usage from the dashboard.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 mt-4">
                <p className="text-xs font-semibold text-foreground mb-3">
                  How a review works:
                </p>
                <ol className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      1
                    </span>
                    <span>
                      <strong className="text-foreground">Fetch</strong> — Pulls
                      PR metadata and file diffs from GitHub.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      2
                    </span>
                    <span>
                      <strong className="text-foreground">Filter</strong> —
                      Excludes files matching your glob patterns.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      3
                    </span>
                    <span>
                      <strong className="text-foreground">Analyse</strong> —
                      Sends chunks to Gemini (direct or via API).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      4
                    </span>
                    <span>
                      <strong className="text-foreground">Post</strong> — Inline
                      comments + summary posted to the PR.
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* ── Installation ─────────────────────── */}
          <section>
            <SectionHeading
              id="installation"
              icon={Terminal}
              title="Installation"
              subtitle="Get GemReview running in under a minute."
            />
            <div className="mt-6 space-y-4 max-w-3xl">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Requirements:</strong>{" "}
                Node.js ≥ 20, a GitHub PAT with <code className="text-xs bg-accent px-1.5 py-0.5 rounded">repo</code> scope.
              </p>
              <CodeBlock title="Install globally">
                {`npm install -g gemreview`}
              </CodeBlock>
              <p className="text-sm text-muted-foreground">
                Or run without installing:
              </p>
              <CodeBlock>{`npx gemreview init`}</CodeBlock>
            </div>
          </section>

          {/* ── Personal Mode ────────────────────── */}
          <section>
            <SectionHeading
              id="personal-mode"
              icon={KeyRound}
              title="Personal Mode"
              subtitle="Use your own Gemini API key. Code stays between you and Google."
            />
            <div className="mt-6 space-y-5 max-w-3xl">
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    1
                  </span>
                  Initialise
                </p>
                <CodeBlock>{`gemreview init\n\n# GemReview will prompt for:\n#  • Gemini API key  (from aistudio.google.com)\n#  • GitHub PAT      (with repo scope)`}</CodeBlock>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    2
                  </span>
                  Review a PR
                </p>
                <CodeBlock>{`gemreview run --pr https://github.com/acme/api/pull/88`}</CodeBlock>
              </div>
            </div>
          </section>

          {/* ── Team Mode ────────────────────────── */}
          <section>
            <SectionHeading
              id="team-mode"
              icon={Users}
              title="Team Mode"
              subtitle="Sign in with GitHub. Share organisation credits with your team."
            />
            <div className="mt-6 space-y-5 max-w-3xl">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      1
                    </span>
                    Login via GitHub
                  </p>
                  <CodeBlock>{`gemreview auth login`}</CodeBlock>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      2
                    </span>
                    Set your local GitHub token
                  </p>
                  <CodeBlock>{`gemreview config set github_token <your_github_pat>`}</CodeBlock>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      3
                    </span>
                    Select your organisation
                  </p>
                  <CodeBlock>{`gemreview org list      # see memberships\ngemreview org use <id>  # switch active context`}</CodeBlock>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      4
                    </span>
                    Run a review
                  </p>
                  <CodeBlock>{`gemreview run --pr <url>`}</CodeBlock>
                </div>
              </div>
            </div>
          </section>

          {/* ── CLI Reference ────────────────────── */}
          <section>
            <SectionHeading
              id="cli-reference"
              icon={Code2}
              title="CLI Reference"
              subtitle="Full command and option reference."
            />
            <div className="mt-6 space-y-6 max-w-3xl">
              {/* Core commands */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Core Commands
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Command
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        ["init", "Interactive setup — API keys, default config"],
                        ["run --pr <url>", "Run a review on a GitHub PR"],
                        ["config show", "Display current global config"],
                        ["config set <key> <val>", "Update a config value"],
                        ["auth login", "Authenticate via GitHub (Team Mode)"],
                        ["auth logout", "Log out of Team Mode"],
                        ["auth status", "Check authentication status"],
                      ].map(([cmd, desc]) => (
                        <tr key={cmd} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary whitespace-nowrap">
                            {cmd}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* run options */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Options for <code className="text-xs bg-accent px-1.5 py-0.5 rounded text-primary">run</code>
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Flag
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        ["--pr <url>", "GitHub PR URL (required)"],
                        ["--dry-run", "Preview findings in terminal only"],
                        [
                          "--dimensions <list>",
                          "Comma-separated: bugs,security,tests,optimisation",
                        ],
                        ["--severity <level>", "Minimum severity: low | medium | high | critical"],
                        ["--verbose", "Debug output"],
                        ["--no-inline", "Skip inline comments, post summary only"],
                        ["--no-summary", "Skip summary, post inline comments only"],
                        ["--prompt", "Generate an AI agent prompt to fix findings"],
                        ["--prompt-output <path>", "Save the agent prompt to a file"],
                      ].map(([flag, desc]) => (
                        <tr key={flag} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary whitespace-nowrap">
                            {flag}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Mode commands */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Team / Org Commands
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Command
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        ["org create <name>", "Create a new organization"],
                        ["org list", "List your organizations"],
                        ["org use <slug>", "Set the active organization"],
                        ["org usage", "View usage stats & remaining credits"],
                        ["org set-gemini-key <key>", "(Admin) Set the shared Gemini key"],
                        ["org members list", "List all members"],
                        ["org members invite <id>", "Invite by GitHub login or email"],
                        ["org members remove <id>", "(Admin) Remove a member"],
                        ["org keys list", "List your API keys"],
                        ["org keys create <name>", "Generate a new CLI API key"],
                        ["org keys delete <id>", "Revoke an API key"],
                        ["org invites show <token>", "View invitation details"],
                        ["org invites accept <token>", "Accept an invitation"],
                      ].map(([cmd, desc]) => (
                        <tr key={cmd} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary whitespace-nowrap">
                            {cmd}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Examples */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Examples
                </h3>
                <div className="space-y-3">
                  <CodeBlock title="Full review">
                    {`gemreview run --pr https://github.com/acme/api/pull/88`}
                  </CodeBlock>
                  <CodeBlock title="Dry run (preview only)">
                    {`gemreview run --pr https://github.com/acme/api/pull/88 --dry-run`}
                  </CodeBlock>
                  <CodeBlock title="Security & bugs only">
                    {`gemreview run --pr https://github.com/acme/api/pull/88 --dimensions bugs,security`}
                  </CodeBlock>
                  <CodeBlock title="High-severity only + save fix prompt">
                    {`gemreview run --pr https://github.com/acme/api/pull/88 \\
  --severity high --prompt --prompt-output fix.md`}
                  </CodeBlock>
                </div>
              </div>
            </div>
          </section>

          {/* ── GitHub Actions ───────────────────── */}
          <section>
            <SectionHeading
              id="github-actions"
              icon={Github}
              title="GitHub Actions"
              subtitle="Automate reviews on every PR — zero CLI setup required."
            />
            <div className="mt-6 space-y-5 max-w-3xl">
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    1
                  </span>
                  Add your Gemini API key as a secret
                </p>
                <p className="text-xs text-muted-foreground mb-3 ml-8">
                  <strong>Settings → Secrets → Actions → New repository secret</strong>
                </p>
                <CodeBlock>{`Name:  GEMINI_API_KEY\nValue: AIzaSy...`}</CodeBlock>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    2
                  </span>
                  Create the workflow file
                </p>
                <CodeBlock title=".github/workflows/gemreview.yml">
                  {`name: GemReview

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write

    steps:
      - uses: Sayandeep-the-coder/gemreview@v1
        with:
          gemini-api-key: \${{ secrets.GEMINI_API_KEY }}`}
                </CodeBlock>
              </div>

              {/* Action Inputs */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Action Inputs
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Input
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Default
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        ["gemini-api-key", "required", "Your Gemini API key (use a secret)"],
                        ["github-token", "auto", "Provided by GitHub automatically"],
                        ["dimensions", "all 4", "bugs,security,tests,optimisation"],
                        ["severity-threshold", "medium", "Minimum severity to post"],
                        ["max-inline-comments", "20", "Cap on inline comments"],
                        ["fail-on-severity", "off", "Fail CI at this severity level"],
                        ["skip-draft-prs", "true", "Skip draft PRs"],
                        ["skip-bots", "true", "Skip bot-authored PRs"],
                        ["dry-run", "false", "Review without posting comments"],
                      ].map(([input, def, desc]) => (
                        <tr key={input} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-xs text-primary whitespace-nowrap">
                            {input}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {def}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs text-foreground font-semibold mb-1 flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-primary" /> Block merges on critical findings
                </p>
                <CodeBlock>
                  {`- uses: Sayandeep-the-coder/gemreview@v1
  with:
    gemini-api-key: \${{ secrets.GEMINI_API_KEY }}
    fail-on-severity: critical`}
                </CodeBlock>
              </div>
            </div>
          </section>

          {/* ── Configuration ────────────────────── */}
          <section>
            <SectionHeading
              id="configuration"
              icon={Settings}
              title="Configuration"
              subtitle="Per-repo and global settings."
            />
            <div className="mt-6 space-y-6 max-w-3xl">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Per-repo config:{" "}
                  <code className="text-xs bg-accent px-1.5 py-0.5 rounded text-primary">
                    .gemreview.json
                  </code>
                </h3>
                <CodeBlock title=".gemreview.json">
                  {`{
  "dimensions": ["bugs", "security", "tests", "optimisation"],
  "severity_threshold": "medium",
  "max_inline_comments": 20,
  "exclude_paths": ["*.lock", "dist/**", "*.min.js"],
  "summary_comment": true,
  "inline_comments": true,
  "model": "gemini-2.5-pro"
}`}
                </CodeBlock>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                        Key
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                        Default
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["dimensions", "string[]", "all 4", "Review dimensions to run"],
                      ["severity_threshold", "string", '"medium"', "Minimum severity for inline comments"],
                      ["max_inline_comments", "number", "20", "Cap on inline comments per review"],
                      ["exclude_paths", "string[]", "[]", "Glob patterns to skip"],
                      ["summary_comment", "boolean", "true", "Post summary comment"],
                      ["inline_comments", "boolean", "true", "Post inline comments"],
                      ["model", "string", '"gemini-2.5-pro"', "Gemini model to use"],
                    ].map(([key, type, def, desc]) => (
                      <tr key={key} className="hover:bg-accent/40 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-primary whitespace-nowrap">
                          {key}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {type}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {def}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Global config (API keys)
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Stored in <code className="bg-accent px-1.5 py-0.5 rounded">~/.gemreview/config.json</code> — never inside a repo.
                </p>
                <CodeBlock>
                  {`gemreview config set gemini_api_key AIzaSy...\ngemreview config set github_token ghp_...`}
                </CodeBlock>
                <p className="text-xs text-muted-foreground mt-3">
                  Or use environment variables:
                </p>
                <CodeBlock>
                  {`export GEMREVIEW_GEMINI_KEY=AIzaSy...\nexport GEMREVIEW_GITHUB_TOKEN=ghp_...\ngemreview run --pr <url>`}
                </CodeBlock>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong className="text-foreground">Precedence:</strong> env
                  vars → config file → defaults
                </p>
              </div>
            </div>
          </section>

          {/* ── Security ─────────────────────────── */}
          <section>
            <SectionHeading
              id="security"
              icon={Shield}
              title="Security & Privacy"
              subtitle="Built with a security-first architecture."
            />
            <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-3xl">
              {[
                {
                  title: "Direct to Google (Personal)",
                  desc: "In Personal Mode, code goes directly from your machine to Google's API. We never see it.",
                },
                {
                  title: "Encrypted Org Keys",
                  desc: "Shared Gemini API keys are encrypted at rest using AES-256-GCM.",
                },
                {
                  title: "No Code Storage (Team)",
                  desc: "In Team Mode, diffs are proxied but never stored beyond the life of the request.",
                },
                {
                  title: "Output Masking",
                  desc: "All API keys and tokens are automatically masked (***) in terminal output.",
                },
                {
                  title: "Local Security",
                  desc: "Config stored in ~/.gemreview/config.json with 600 permissions.",
                },
                {
                  title: "Dry-run First",
                  desc: "Use --dry-run to preview findings without any write calls to GitHub.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
                >
                  <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-green-400" />
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ──────────────────────────────── */}
          <section>
            <SectionHeading
              id="faq"
              icon={Sparkles}
              title="Frequently Asked Questions"
            />
            <div className="mt-6 space-y-4 max-w-3xl">
              {[
                {
                  q: "Which languages does GemReview support?",
                  a: "GemReview analyses diffs, so it works with any programming language supported in your PR.",
                },
                {
                  q: "Do I need a Gemini API key for Team Mode?",
                  a: "No. In Team Mode, the organisation admin sets a shared Gemini key. Individual members only need a GitHub PAT.",
                },
                {
                  q: "Does GemReview store my code?",
                  a: "No. In Personal Mode, code goes directly to Google. In Team Mode, diffs are proxied but never persisted beyond the request.",
                },
                {
                  q: "Can I block merges based on findings?",
                  a: 'Yes! Use the GitHub Action with fail-on-severity: critical to fail the CI check when critical issues are found.',
                },
                {
                  q: "How do I change the Gemini model?",
                  a: 'Set the "model" field in your .gemreview.json. Default is gemini-2.5-pro.',
                },
                {
                  q: "Can I exclude files from reviews?",
                  a: 'Yes — add glob patterns to the "exclude_paths" array in .gemreview.json, e.g. ["*.lock", "dist/**"].',
                },
              ].map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-border bg-card overflow-hidden"
                >
                  <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-medium text-foreground hover:bg-accent/40 transition-colors select-none">
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                    {item.q}
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3 ml-7">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ── CTA ──────────────────────────────── */}
          <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/60 p-8 text-center max-w-3xl">
            <Bot className="mx-auto h-10 w-10 text-primary mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              Ready to get started?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Install GemReview and run your first AI-powered code review in
              under a minute.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <a
                href="https://www.npmjs.com/package/gemreview"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
              >
                <Terminal className="h-4 w-4" />
                npm install -g gemreview
              </a>
            </div>
          </section>
        </main>

        {/* Sidebar TOC (Right Side) */}
        <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] w-[240px] shrink-0 overflow-y-auto py-12 px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            On this page
          </p>
          <nav className="flex flex-col gap-1">
            {toc.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all border border-transparent hover:border-border"
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-border">
            <h4 className="text-xs font-semibold text-foreground mb-3">Community</h4>
            <a
              href="https://github.com/Sayandeep-the-coder/gemreview"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all border border-transparent hover:border-border"
            >
              <Github className="h-4 w-4 shrink-0 px-[1px]" />
              GitHub Repository
            </a>
          </div>
        </aside>
      </div>

      {/* ─── Footer ──────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1400px] flex items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span>GemReview — AI-powered PR reviews</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Sayandeep-the-coder/gemreview"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/gemreview"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              npm
            </a>
            <span>MIT © 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
