import type { ProjectConfig } from './schema.js';

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
] as const;

export type GlobalConfigKey = (typeof GLOBAL_CONFIG_KEYS)[number];
