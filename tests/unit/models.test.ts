import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTokens,
  detectModelQuota,
  getSafeChunkTokens,
  fetchEligibleModels,
  fetchCurrentModel,
} from '../../src/gemini/models.js';

describe('Google AI Studio models utilities', () => {
  describe('formatTokens', () => {
    it('formats millions of tokens accurately', () => {
      expect(formatTokens(1_000_000)).toBe('1M');
      expect(formatTokens(2_097_152)).toBe('2.1M');
    });

    it('formats thousands of tokens accurately', () => {
      expect(formatTokens(8_192)).toBe('8.2k');
      expect(formatTokens(4_000)).toBe('4k');
    });

    it('handles small or missing numbers', () => {
      expect(formatTokens(500)).toBe('500');
      expect(formatTokens(0)).toBe('N/A');
    });
  });

  describe('detectModelQuota', () => {
    it('returns Gemma quota and family for Gemma open models', () => {
      const quota = detectModelQuota('gemma-2-27b-it');
      expect(quota.family).toBe('Gemma (Open Model)');
      expect(quota.rpm).toBe('30 RPM');
      expect(quota.tpm).toBe('16k TPM');
      expect(quota.rpd).toBe('1,500 RPD');
    });

    it('returns Pro quota for Gemini Pro models', () => {
      const quota = detectModelQuota('gemini-2.5-pro');
      expect(quota.family).toBe('Gemini Pro');
      expect(quota.rpm).toBe('2 RPM');
      expect(quota.tpm).toBe('32k TPM');
      expect(quota.rpd).toBe('50 RPD');
    });

    it('returns Flash quota for Gemini Flash models', () => {
      const quota = detectModelQuota('gemini-2.5-flash');
      expect(quota.family).toBe('Gemini Flash');
      expect(quota.rpm).toBe('15 RPM');
      expect(quota.tpm).toBe('1M TPM');
      expect(quota.rpd).toBe('1,500 RPD');
    });

    it('returns Flash-Lite quota for Flash-Lite models', () => {
      const quota = detectModelQuota('gemini-2.0-flash-lite');
      expect(quota.family).toBe('Gemini Flash-Lite');
      expect(quota.rpm).toBe('30 RPM');
      expect(quota.tpm).toBe('1M TPM');
    });
    it('returns Thinking quota for Thinking models', () => {
      const quota = detectModelQuota('gemini-2.0-flash-thinking-exp');
      expect(quota.family).toBe('Gemini Thinking');
      expect(quota.rpm).toBe('10 RPM');
      expect(quota.minDelayBetweenRequestsMs).toBe(6300);
    });

    it('paces Pro models at 31.5s to strictly avoid 2 RPM 429 errors', () => {
      const quota = detectModelQuota('gemini-2.5-pro');
      expect(quota.minDelayBetweenRequestsMs).toBe(31500);
    });

    it('paces Flash models at 4.2s to stay under 15 RPM limit', () => {
      const quota = detectModelQuota('gemini-2.5-flash');
      expect(quota.minDelayBetweenRequestsMs).toBe(4200);
    });
  });

  describe('getSafeChunkTokens', () => {
    it('adapts chunk size for small context models like Gemma', () => {
      const gemmaInfo = {
        id: 'gemma-2-27b-it',
        displayName: 'Gemma 2 27B',
        inputTokenLimit: 8192,
        outputTokenLimit: 8192,
        supportedMethods: ['generateContent'],
        quota: detectModelQuota('gemma-2-27b-it'),
      };
      const chunkSize = getSafeChunkTokens(gemmaInfo);
      expect(chunkSize).toBe(4000);
    });

    it('caps Pro chunk size at 12,000 to prevent saturating 32k TPM free tier', () => {
      const proInfo = {
        id: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        inputTokenLimit: 1048576,
        outputTokenLimit: 8192,
        supportedMethods: ['generateContent'],
        quota: detectModelQuota('gemini-2.5-pro'),
      };
      const chunkSize = getSafeChunkTokens(proInfo);
      expect(chunkSize).toBe(12000);
    });

    it('caps chunk size at 80,000 for large context models like Gemini Flash', () => {
      const geminiInfo = {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        inputTokenLimit: 1048576,
        outputTokenLimit: 8192,
        supportedMethods: ['generateContent'],
        quota: detectModelQuota('gemini-2.5-flash'),
      };
      const chunkSize = getSafeChunkTokens(geminiInfo);
      expect(chunkSize).toBe(80000);
    });
  });

  describe('getModelFallbackChain', () => {
    it('provides Flash models as fallback for Gemini Pro', async () => {
      const { getModelFallbackChain } = await import('../../src/gemini/models.js');
      const chain = getModelFallbackChain('gemini-2.5-pro');
      expect(chain).toContain('gemini-2.5-flash');
      expect(chain).toContain('gemini-2.0-flash');
      expect(chain).not.toContain('gemini-2.5-pro');
    });

    it('provides Flash models as fallback for Gemma', async () => {
      const { getModelFallbackChain } = await import('../../src/gemini/models.js');
      const chain = getModelFallbackChain('gemma-2-27b-it');
      expect(chain).toContain('gemini-2.5-flash');
      expect(chain).not.toContain('gemma-2-27b-it');
    });

    it('provides sibling Flash models when a Flash model is overloaded', async () => {
      const { getModelFallbackChain } = await import('../../src/gemini/models.js');
      const chain = getModelFallbackChain('gemini-2.5-flash');
      expect(chain).not.toContain('gemini-2.5-flash');
      expect(chain).toContain('gemini-2.0-flash');
      expect(chain).toContain('gemini-1.5-flash');
    });
  });

  describe('fetchEligibleModels & fetchCurrentModel', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const mockApiResponse = {
      models: [
        {
          name: 'models/text-embedding-004',
          displayName: 'Embedding Model',
          supportedGenerationMethods: ['embedContent'],
          inputTokenLimit: 2048,
          outputTokenLimit: 1,
        },
        {
          name: 'models/gemma-2-27b-it',
          displayName: 'Gemma 2 27B IT',
          description: 'Open weight Gemma instruction-tuned model',
          supportedGenerationMethods: ['generateContent', 'countTokens'],
          inputTokenLimit: 8192,
          outputTokenLimit: 8192,
        },
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          description: 'Fast flagship model',
          supportedGenerationMethods: ['generateContent', 'countTokens'],
          inputTokenLimit: 1048576,
          outputTokenLimit: 8192,
        },
      ],
    };

    it('fetches and dynamically includes Gemma, Gemini, and all generative models from AI Studio', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      const models = await fetchEligibleModels('valid-key');

      expect(models).toHaveLength(2);

      const gemmaModel = models.find((m) => m.id === 'gemma-2-27b-it');
      expect(gemmaModel).toBeDefined();
      expect(gemmaModel?.inputTokenLimit).toBe(8192);
      expect(gemmaModel?.outputTokenLimit).toBe(8192);
      expect(gemmaModel?.quota.family).toBe('Gemma (Open Model)');
      expect(gemmaModel?.quota.rpm).toBe('30 RPM');
      expect(gemmaModel?.quota.tpm).toBe('16k TPM');

      const geminiModel = models.find((m) => m.id === 'gemini-2.5-flash');
      expect(geminiModel).toBeDefined();
      expect(geminiModel?.inputTokenLimit).toBe(1048576);
      expect(geminiModel?.quota.rpm).toBe('15 RPM');
    });

    it('fetchCurrentModel returns requested model with live data when available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      const current = await fetchCurrentModel('valid-key', 'gemma-2-27b-it');
      expect(current.id).toBe('gemma-2-27b-it');
      expect(current.isCurrent).toBe(true);
      expect(current.inputTokenLimit).toBe(8192);
    });

    it('fetchCurrentModel defaults to top recommended model when preferred is not in list', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      const current = await fetchCurrentModel('valid-key', 'non-existent-model');
      expect(current.id).toBe('gemini-2.5-flash');
      expect(current.isCurrent).toBe(true);
    });

    it('throws error with API message if response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'API key not valid. Please pass a valid API key.' },
        }),
      } as any);

      await expect(fetchEligibleModels('invalid-key')).rejects.toThrow(
        'API key not valid. Please pass a valid API key.',
      );
    });
  });
});
