import { z } from 'zod';

export const DimensionEnum = z.enum(['bugs', 'security', 'tests', 'optimisation']);
export const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const ProjectConfigSchema = z.object({
  dimensions: z.array(DimensionEnum).default(['bugs', 'security', 'tests', 'optimisation']),
  severity_threshold: SeverityEnum.default('medium'),
  max_inline_comments: z.number().int().min(1).max(100).default(20),
  exclude_paths: z.array(z.string()).default(['*.lock', 'dist/**', '*.min.js', '*.generated.*']),
  summary_comment: z.boolean().default(true),
  inline_comments: z.boolean().default(true),
  model: z.string().default('gemini-2.5-flash'),
});

export const GlobalConfigSchema = z.object({
  gemini_api_key: z.string().optional(),
  github_token: z.string().min(1, 'GitHub token is required'),
  github_base_url: z.string().url().optional().default('https://api.github.com'),
  model: z.string().optional(),
  // Team features (v1.3.0)
  gemreview_token: z.string().optional(),
  active_org: z.string().optional(),
  org_api_key: z.string().optional(),
});

export const ReviewConfigSchema = ProjectConfigSchema.merge(GlobalConfigSchema).extend({
  model: z.string().default('gemini-2.5-flash'),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;
