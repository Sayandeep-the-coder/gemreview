import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ReviewConfigSchema, type ReviewConfig } from './schema.js';
import { PROJECT_DEFAULTS } from './defaults.js';

function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.gemreview', 'config.json');
}

function loadGlobalConfig(): Record<string, unknown> {
  const configPath = getGlobalConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Global config not found at ${configPath}. Run "gemreview init" to set up your configuration.`,
    );
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function loadProjectConfig(): Record<string, unknown> {
  const configPath = path.join(process.cwd(), '.gemreview.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function loadEnvOverrides(): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  if (process.env.GEMREVIEW_GEMINI_KEY) {
    overrides.gemini_api_key = process.env.GEMREVIEW_GEMINI_KEY;
  }
  if (process.env.GEMREVIEW_GITHUB_TOKEN) {
    overrides.github_token = process.env.GEMREVIEW_GITHUB_TOKEN;
  }
  return overrides;
}

export interface CliOverrides {
  dimensions?: string[];
  severity_threshold?: string;
  max_inline_comments?: number;
  model?: string;
  [key: string]: unknown;
}

export function loadConfig(cliOverrides: CliOverrides = {}): ReviewConfig {
  const globalConfig = loadGlobalConfig();
  const projectConfig = loadProjectConfig();
  const envOverrides = loadEnvOverrides();

  // Remove undefined values from CLI overrides
  const cleanCliOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cliOverrides)) {
    if (value !== undefined) {
      cleanCliOverrides[key] = value;
    }
  }

  // Merge in order: defaults → global config → project config → env vars → CLI overrides
  const merged = {
    ...PROJECT_DEFAULTS,
    ...globalConfig,
    ...projectConfig,
    ...envOverrides,
    ...cleanCliOverrides,
  };

  const result = ReviewConfigSchema.safeParse(merged);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return result.data;
}

export { getGlobalConfigPath };
