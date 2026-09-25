export interface ModelQuota {
  rpm: string;
  tpm: string;
  rpd: string;
  family: string;
  rpmNumber: number;
  tpmNumber: number;
  minDelayBetweenRequestsMs: number;
}

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedMethods: string[];
  quota: ModelQuota;
  isRecommended?: boolean;
  isCurrent?: boolean;
}

export function formatTokens(tokens: number): string {
  if (!tokens || tokens <= 0) return 'N/A';
  if (tokens >= 1_000_000) {
    const millions = (tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1);
    return `${millions}M`;
  }
  if (tokens >= 1_000) {
    const thousands = (tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1);
    return `${thousands}k`;
  }
  return tokens.toLocaleString();
}

/**
 * Determines free tier limits based on Google AI Studio specifications:
 * - Gemma: 30 RPM, 16k TPM, 1,500 RPD (paced at 12s to avoid 16k TPM saturation)
 * - Gemini Pro: 2 RPM, 32k TPM, 50 RPD (paced at 31.5s for 2 RPM)
 * - Gemini Flash-Lite / Flash-8b: 30 RPM, 1M TPM, 1,500 RPD (paced at 2.1s for 30 RPM)
 * - Gemini Flash (2.5, 2.0, 1.5, 3.x): 15 RPM, 1M TPM, 1,500 RPD (paced at 4.2s for 15 RPM)
 * - Gemini Thinking / Experimental: 10 RPM, 64k TPM, 1,500 RPD (paced at 6.3s for 10 RPM)
 */
export function detectModelQuota(modelId: string): ModelQuota {
  const lower = modelId.toLowerCase();

  if (lower.includes('gemma')) {
    return {
      rpm: '30 RPM',
      tpm: '16k TPM',
      rpd: '1,500 RPD',
      family: 'Gemma (Open Model)',
      rpmNumber: 30,
      tpmNumber: 16000,
      minDelayBetweenRequestsMs: 12000,
    };
  }
  if (lower.includes('pro')) {
    return {
      rpm: '2 RPM',
      tpm: '32k TPM',
      rpd: '50 RPD',
      family: 'Gemini Pro',
      rpmNumber: 2,
      tpmNumber: 32000,
      minDelayBetweenRequestsMs: 31500,
    };
  }
  if (lower.includes('thinking')) {
    return {
      rpm: '10 RPM',
      tpm: '64k TPM',
      rpd: '1,500 RPD',
      family: 'Gemini Thinking',
      rpmNumber: 10,
      tpmNumber: 64000,
      minDelayBetweenRequestsMs: 6300,
    };
  }
  if (lower.includes('flash-lite') || lower.includes('flash-8b')) {
    return {
      rpm: '30 RPM',
      tpm: '1M TPM',
      rpd: '1,500 RPD',
      family: 'Gemini Flash-Lite',
      rpmNumber: 30,
      tpmNumber: 1000000,
      minDelayBetweenRequestsMs: 2100,
    };
  }
  if (lower.includes('flash')) {
    return {
      rpm: '15 RPM',
      tpm: '1M TPM',
      rpd: '1,500 RPD',
      family: 'Gemini Flash',
      rpmNumber: 15,
      tpmNumber: 1000000,
      minDelayBetweenRequestsMs: 4200,
    };
  }

  return {
    rpm: '15 RPM',
    tpm: '1M TPM',
    rpd: '1,500 RPD',
    family: 'AI Studio Model',
    rpmNumber: 15,
    tpmNumber: 1000000,
    minDelayBetweenRequestsMs: 4200,
  };
}

/**
 * Calculates a safe chunk token limit for PR diff analysis based on the model's actual context window
 * and rate-limit tier (TPM - Tokens Per Minute).
 */
export function getSafeChunkTokens(modelInfo: GeminiModelInfo): number {
  if (!modelInfo.inputTokenLimit || modelInfo.inputTokenLimit <= 0) {
    return 80000;
  }
  const lower = modelInfo.id.toLowerCase();

  // Gemma models have a strict 16,000 input tokens per minute (TPM) limit on AI Studio free tier
  if (lower.includes('gemma')) {
    return Math.min(4000, Math.max(1000, Math.floor(modelInfo.inputTokenLimit * 0.5)));
  }

  // Pro models have 32k TPM free-tier limit
  if (lower.includes('pro')) {
    return Math.min(12000, Math.floor(modelInfo.inputTokenLimit * 0.75));
  }

  // Thinking models
  if (lower.includes('thinking')) {
    return Math.min(16000, Math.floor(modelInfo.inputTokenLimit * 0.75));
  }

  // Flash models have 1M TPM
  const safeTokens = Math.floor(modelInfo.inputTokenLimit * 0.75);
  return Math.max(1000, Math.min(80000, safeTokens));
}

/**
 * Recommended pause in ms between requests to respect model RPM and avoid burst 429 quota errors.
 */
export function getModelRequestDelayMs(modelId: string): number {
  return detectModelQuota(modelId).minDelayBetweenRequestsMs;
}

/**
 * Returns prioritized fallback models for 429 quota exhaustion or 503 service overload.
 * Ensures that if a user's selected model fails or is rate-limited, GemReview seamlessly
 * falls back to an available, high-capacity model in Google AI Studio.
 */
export function getModelFallbackChain(currentModel: string): string[] {
  const cleanCurrent = currentModel.replace(/^models\//, '').trim().toLowerCase();

  const flashPool = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
  ];

  if (cleanCurrent.includes('pro')) {
    return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
  }

  if (cleanCurrent.includes('gemma')) {
    return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  }

  return flashPool.filter((id) => id !== cleanCurrent);
}

function isTextOrCodeModel(id: string, description: string = ''): boolean {
  const lowerId = id.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // Exclude non-text/code specialized models (TTS, image-only, music, transcription, robotics)
  if (
    lowerId.includes('-tts') ||
    lowerId.includes('tts-') ||
    lowerId.includes('-image') ||
    lowerId.includes('image-') ||
    lowerId.includes('transcribe') ||
    lowerId.includes('robotics') ||
    lowerId.includes('lyria') ||
    lowerId.includes('clip') ||
    lowerDesc.includes('music generation') ||
    lowerDesc.includes('text to speech') ||
    lowerDesc.includes('speech generation') ||
    lowerDesc.includes('audio generation')
  ) {
    return false;
  }
  return true;
}

/**
 * Fetches all generative models directly from Google AI Studio API for the given API key.
 * All models that support text/code content generation (Gemini, Gemma, etc.) are parsed dynamically.
 */
export async function fetchEligibleModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as any;
    const msg = errorBody?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(msg);
  }

  const data = (await response.json()) as { models?: Array<any> };
  const rawModels = data.models || [];

  // Filter to text/code generative models (Gemini, Gemma, Deep Research, etc.)
  const eligible = rawModels
    .filter((m) => {
      const methods = (m.supportedGenerationMethods || []) as string[];
      if (!methods.includes('generateContent')) return false;
      const id = (m.name || '').replace(/^models\//, '');
      return isTextOrCodeModel(id, m.description || '');
    })
    .map((m): GeminiModelInfo => {
      const id = (m.name || '').replace(/^models\//, '');
      const quota = detectModelQuota(id);
      const isRecommended = id === 'gemini-2.5-flash' || id === 'gemini-2.0-flash';

      return {
        id,
        displayName: m.displayName || id,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit || 0,
        outputTokenLimit: m.outputTokenLimit || 0,
        supportedMethods: m.supportedGenerationMethods || [],
        quota,
        isRecommended,
      };
    });

  // Sort: Recommended flagship flash models first, then Pro, then Gemma, then others
  eligible.sort((a, b) => {
    const familyWeight = (info: GeminiModelInfo) => {
      if (info.isRecommended) return 0;
      if (info.quota.family === 'Gemini Flash') return 1;
      if (info.quota.family === 'Gemini Flash-Lite') return 2;
      if (info.quota.family === 'Gemini Pro') return 3;
      if (info.quota.family.includes('Gemma')) return 4;
      return 5;
    };

    const diff = familyWeight(a) - familyWeight(b);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return eligible;
}

/**
 * Always resolves and fetches the active/current model from Google AI Studio's live model catalog.
 * If preferredModel is provided, it finds and returns that model with its live limits.
 * If preferredModel is not found or not provided, it returns the top recommended live model.
 */
export async function fetchCurrentModel(
  apiKey: string,
  preferredModel?: string,
): Promise<GeminiModelInfo> {
  const models = await fetchEligibleModels(apiKey);

  if (models.length === 0) {
    throw new Error('No eligible content-generation models found in this Google AI Studio account.');
  }

  if (preferredModel && preferredModel.trim() !== '') {
    const cleanPreferred = preferredModel.replace(/^models\//, '').trim().toLowerCase();
    const match = models.find((m) => m.id.toLowerCase() === cleanPreferred);
    if (match) {
      return { ...match, isCurrent: true };
    }
  }

  // If no match or none specified, return the top recommended live model from AI Studio
  const topModel = models[0];
  return { ...topModel, isCurrent: true };
}
