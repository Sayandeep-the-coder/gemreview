import type { ProjectConfig } from './schema.js';

// API base URL — override with GEMREVIEW_API_URL env var for local dev
export const API_BASE_URL =
  process.env.GEMREVIEW_API_URL ?? 'https://gemreview-api.onrender.com';

export const PROJECT_DEFAULTS: ProjectConfig = {
  dimensions: ['bugs', 'security', 'tests', 'optimisation'],
  severity_threshold: 'medium',
  max_inline_comments: 20,
  exclude_paths: ['*.lock', 'dist/**', '*.min.js', '*.generated.*'],
  summary_comment: true,
  inline_comments: true,
  model: 'gemini-2.5-flash',
};

export const GLOBAL_CONFIG_KEYS = [
  'gemini_api_key',
  'github_token',
  'github_base_url',
  'model',
  'gemreview_token',
  'active_org',
  'org_api_key',
  'api_url',
] as const;

export type GlobalConfigKey = (typeof GLOBAL_CONFIG_KEYS)[number];
