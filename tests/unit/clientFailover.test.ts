import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGeminiClient } from '../../src/gemini/client.js';

describe('GeminiClient dynamic 429 & 503 failover handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fails over to Flash model when Pro model hits free-tier 429 rate limit with long wait', async () => {
    let callCount = 0;
    const requestedModels: string[] = [];

    // Mock logger to avoid printing in test output
    const logger = await import('../../src/output/logger.js');
    vi.spyOn(logger, 'warn').mockImplementation(async () => {});
    vi.spyOn(logger, 'debug').mockImplementation(async () => {});

    // Create client for gemini-2.5-pro
    const client = createGeminiClient('test-key', 'gemini-2.5-pro');

    // Spy on getGenerativeModel
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation((params: any) => {
      requestedModels.push(params.model);
      return {
        generateContent: vi.fn().mockImplementation(async () => {
          callCount++;
          if (params.model === 'gemini-2.5-pro') {
            // First call with Pro model fails with 429 and requested wait 20s
            const err: any = new Error(
              'RESOURCE_EXHAUSTED: Quota exceeded for metric: generativelanguage.googleapis.com/queries, limit: 2. Please retry in 20.0s.',
            );
            err.status = 429;
            throw err;
          }
          // Fallback model succeeds
          return {
            response: {
              text: () => JSON.stringify([{ file: 'index.ts', line: 1, dimension: 'bugs', severity: 'high', title: 'Bug', description: 'Desc', confidence: 0.9 }]),
            },
          };
        }),
      } as any;
    });

    const result = await client.review('System instruction', 'User prompt');
    expect(result).toBeDefined();
    // Verify that the client dynamically switched to a Flash model
    expect(client.getActiveModel()).toBe('gemini-2.5-flash');
    expect(requestedModels).toContain('gemini-2.5-pro');
    expect(requestedModels).toContain('gemini-2.5-flash');
  });

  it('fails over to alternative model when current model hits 503 overload twice', async () => {
    const requestedModels: string[] = [];
    const logger = await import('../../src/output/logger.js');
    vi.spyOn(logger, 'warn').mockImplementation(async () => {});
    vi.spyOn(logger, 'debug').mockImplementation(async () => {});

    // Fast-forward setTimeout to speed up backoff delays in tests
    vi.useFakeTimers();

    const client = createGeminiClient('test-key', 'gemini-2.5-flash');

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation((params: any) => {
      requestedModels.push(params.model);
      return {
        generateContent: vi.fn().mockImplementation(async () => {
          if (params.model === 'gemini-2.5-flash') {
            const err: any = new Error('[503 Service Unavailable] The model is overloaded. Please try again later.');
            err.status = 503;
            throw err;
          }
          return {
            response: {
              text: () => '[]',
            },
          };
        }),
      } as any;
    });

    const reviewPromise = client.review('System', 'User');

    // Advance fake timers so backoffs resolve instantly
    await vi.runAllTimersAsync();

    const result = await reviewPromise;
    expect(result).toBe('[]');
    // Model switched to a sibling flash fallback (e.g. gemini-2.0-flash)
    expect(client.getActiveModel()).toBe('gemini-2.0-flash');
    expect(requestedModels).toContain('gemini-2.5-flash');
    expect(requestedModels).toContain('gemini-2.0-flash');

    vi.useRealTimers();
  });

  it('fails over immediately when daily quota (RPD) is exhausted', async () => {
    const requestedModels: string[] = [];
    const logger = await import('../../src/output/logger.js');
    vi.spyOn(logger, 'warn').mockImplementation(async () => {});
    vi.spyOn(logger, 'debug').mockImplementation(async () => {});

    const client = createGeminiClient('test-key', 'gemini-1.5-pro');

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation((params: any) => {
      requestedModels.push(params.model);
      return {
        generateContent: vi.fn().mockImplementation(async () => {
          if (params.model === 'gemini-1.5-pro') {
            const err: any = new Error(
              '429 Quota exceeded for quota metric GenerateContent requests per day. Limit: 50.',
            );
            err.status = 429;
            throw err;
          }
          return {
            response: {
              text: () => '[]',
            },
          };
        }),
      } as any;
    });

    const result = await client.review('System', 'User');
    expect(result).toBe('[]');
    expect(client.getActiveModel()).toBe('gemini-2.5-flash');
    expect(requestedModels).toContain('gemini-1.5-pro');
    expect(requestedModels).toContain('gemini-2.5-flash');
  });
});
