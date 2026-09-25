import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from '../output/logger.js';
import { getModelRequestDelayMs, getModelFallbackChain } from './models.js';

export interface GeminiClient {
  review(systemPrompt: string, userPrompt: string): Promise<string>;
  getActiveModel(): string;
}

/**
 * Extracts Google's requested retry delay from 429 quota / rate limit errors or 503 overload errors.
 * Google returns strings and JSON structures like:
 * - 'Please retry in 23.397240621s.'
 * - 'Please retry after 23.397s.'
 * - '{"@type":"...RetryInfo","retryDelay":"23s"}'
 * - '{"retryDelay":{"seconds":"23","nanos":500000000}}'
 * - 'retry after 2026-09-25T07:50:00Z'
 * - HTTP Retry-After header: '25'
 */
export function extractRetryDelayMs(error: any): number | null {
  if (!error) return null;

  // 1. Direct object inspection (errorDetails, statusDetails, or details array)
  const details = error.errorDetails || error.statusDetails || error.details;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item && item.retryDelay) {
        if (typeof item.retryDelay === 'string') {
          const match = item.retryDelay.match(/^(\d+(?:\.\d+)?)s?$/);
          if (match) {
            const sec = parseFloat(match[1]);
            if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1000);
          }
        } else if (typeof item.retryDelay === 'object') {
          const sec = Number(item.retryDelay.seconds || 0);
          const nanos = Number(item.retryDelay.nanos || 0);
          const totalMs = Math.ceil(sec * 1000 + nanos / 1e6);
          if (totalMs > 0) return totalMs;
        } else if (typeof item.retryDelay === 'number' && item.retryDelay > 0) {
          return Math.ceil(item.retryDelay * 1000);
        }
      }
    }
  }

  // 2. HTTP header retry-after
  const headers = error.response?.headers || error.headers;
  if (headers) {
    const retryAfter =
      typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after'];
    if (retryAfter) {
      const parsedSec = parseFloat(retryAfter);
      if (!isNaN(parsedSec) && parsedSec > 0) {
        return Math.ceil(parsedSec * 1000);
      }
      const parsedDate = Date.parse(retryAfter);
      if (!isNaN(parsedDate)) {
        const diff = parsedDate - Date.now();
        if (diff > 0) return diff;
      }
    }
  }

  // 3. String & message inspection
  let text = '';
  if (typeof error === 'string') {
    text = error;
  } else {
    text = error.message || '';
    try {
      text += ' ' + JSON.stringify(error);
    } catch {
      // ignore circular json
    }
  }

  // Pattern A: "retryDelay": "23s" or retryDelay: "23.5s" or retryDelay: 23s
  const retryDelayMatch = text.match(/"?retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s?"?/i);
  if (retryDelayMatch && retryDelayMatch[1]) {
    const sec = parseFloat(retryDelayMatch[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.ceil(sec * 1000);
    }
  }

  // Pattern B: "retryDelay": {"seconds": "23", ...}
  const retryObjMatch = text.match(/"?retryDelay"?\s*:\s*\{[^}]*"?seconds"?\s*:\s*"?(\d+)"?/i);
  if (retryObjMatch && retryObjMatch[1]) {
    const sec = parseInt(retryObjMatch[1], 10);
    if (!isNaN(sec) && sec > 0) {
      return sec * 1000;
    }
  }

  // Pattern C: "Please retry in 23.397s" or "retry in 23s"
  const retryInMatch = text.match(/retry\s+in\s+(\d+(?:\.\d+)?)s/i);
  if (retryInMatch && retryInMatch[1]) {
    const sec = parseFloat(retryInMatch[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.ceil(sec * 1000);
    }
  }

  // Pattern D: "Please retry after 23.397s" or "retry after 23s"
  const retryAfterMatch = text.match(/retry\s+after\s+(\d+(?:\.\d+)?)s/i);
  if (retryAfterMatch && retryAfterMatch[1]) {
    const sec = parseFloat(retryAfterMatch[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.ceil(sec * 1000);
    }
  }

  // Pattern E: "retry after 2026-09-25T07:50:00Z"
  const retryDateMatch = text.match(/retry\s+after\s+(\d{4}-\d{2}-\d{2}T[0-9:.]+Z?)/i);
  if (retryDateMatch && retryDateMatch[1]) {
    const time = Date.parse(retryDateMatch[1]);
    if (!isNaN(time)) {
      const diff = time - Date.now();
      if (diff > 0) return diff;
    }
  }

  return null;
}

export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 429) return true;

  const msg = (typeof error === 'string' ? error : error.message || '') +
    (error.statusText || '');
  const lower = msg.toLowerCase();

  return (
    lower.includes('429') ||
    (lower.includes('resource') && lower.includes('exhausted')) ||
    lower.includes('quota exceeded') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit_exceeded') ||
    lower.includes('too many requests') ||
    lower.includes('queries per minute') ||
    lower.includes('tokens per minute')
  );
}

export function isDailyQuotaError(error: any): boolean {
  if (!isRateLimitError(error)) return false;
  const msg = typeof error === 'string' ? error : error.message || '';
  const lower = msg.toLowerCase();

  return (
    lower.includes('requests per day') ||
    lower.includes('perday') ||
    lower.includes('per_day') ||
    lower.includes('daily limit') ||
    lower.includes('day quota')
  );
}

export function isTransientError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 503 || status === 500 || status === 502 || status === 504) return true;

  const msg = (typeof error === 'string' ? error : error.message || '') +
    (error.statusText || '');
  const lower = msg.toLowerCase();

  return (
    lower.includes('503') ||
    lower.includes('service unavailable') ||
    lower.includes('the model is overloaded') ||
    lower.includes('model is overloaded') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('capacity') ||
    lower.includes('deadline_exceeded')
  );
}

export function createGeminiClient(apiKey: string | undefined, model: string): GeminiClient {
  const genAI = new GoogleGenerativeAI(apiKey || '');
  let activeModel = model;
  let lastRequestEndTime = 0;
  let adaptiveMultiplier = 1.0;
  let callQueue: Promise<any> = Promise.resolve();

  async function paceRequest(): Promise<void> {
    const baseDelay = getModelRequestDelayMs(activeModel);
    const minDelay = Math.ceil(baseDelay * adaptiveMultiplier);
    if (minDelay > 0 && lastRequestEndTime > 0) {
      const elapsed = Date.now() - lastRequestEndTime;
      if (elapsed < minDelay) {
        const waitMs = minDelay - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  async function executeReview(systemPrompt: string, userPrompt: string): Promise<string> {
    let lastError: Error | null = null;
    const maxModelCycles = 4; // allow cycling through model fallback chain if needed
    const triedModels = new Set<string>();
    triedModels.add(activeModel.toLowerCase());

    for (let modelCycle = 0; modelCycle < maxModelCycles; modelCycle++) {
      const geminiModel = genAI.getGenerativeModel(
        {
          model: activeModel,
          systemInstruction: systemPrompt,
        },
        { apiVersion: 'v1beta' },
      );

      const maxRetries = 5;
      const fallbackDelays = [4000, 8000, 16000, 24000, 32000];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Wait for dynamic RPM/TPM pacing before sending request
          await paceRequest();

          const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.0,
              maxOutputTokens: 8192,
            },
          });

          lastRequestEndTime = Date.now();
          // Gradually decay adaptive delay multiplier on successful call
          if (adaptiveMultiplier > 1.0) {
            adaptiveMultiplier = Math.max(1.0, adaptiveMultiplier - 0.1);
          }

          const response = result.response;
          const text = response.text();
          return text;
        } catch (error: any) {
          lastRequestEndTime = Date.now();

          const isNotFound =
            error.status === 404 ||
            error.message?.includes('404') ||
            error.message?.includes('is not found') ||
            error.message?.includes('no longer available');

          const isRateLimit = isRateLimitError(error);
          const isDailyQuota = isDailyQuotaError(error);
          const isTransient = isTransientError(error);

          // If model not found, try replacement or fallback
          if (isNotFound) {
            lastError = error;

            // Check if Google suggested a replacement model in the error message
            const match = error.message?.match(/use\s+(?:models\/)?([a-zA-Z0-9_.-]+)/i);
            if (match && match[1] && match[1] !== activeModel) {
              const suggested = match[1].replace(/^models\//, '');
              await logger.warn(
                `Model "${activeModel}" is no longer available. Google recommends "${suggested}". Automatically switching...`,
              );
              activeModel = suggested;
              break;
            }

            const fallbacks = getModelFallbackChain(activeModel).filter((m) => !triedModels.has(m));
            if (fallbacks.length > 0) {
              const nextModel = fallbacks[0];
              triedModels.add(nextModel.toLowerCase());
              await logger.warn(`Model "${activeModel}" not found. Switching to "${nextModel}"...`);
              activeModel = nextModel;
              break;
            }
            break;
          }

          // 1. Daily Quota Limit Hit (RPD) — retrying same model will fail for 24h
          if (isDailyQuota) {
            const fallbacks = getModelFallbackChain(activeModel).filter((m) => !triedModels.has(m));
            if (fallbacks.length > 0) {
              const nextModel = fallbacks[0];
              triedModels.add(nextModel.toLowerCase());
              await logger.warn(
                `Model "${activeModel}" has exhausted its daily free-tier quota (RPD). ` +
                  `⚡ Dynamically switching to "${nextModel}" (1,500 RPD) to continue review...`,
              );
              activeModel = nextModel;
              break; // Switch to next model in cycle
            }
          }

          // 2. 503 Overloaded / Service Unavailable
          if (isTransient && attempt < maxRetries) {
            // Full jitter backoff: base * 1.5^attempt + random jitter
            const baseDelay = 3000 * Math.pow(1.5, attempt);
            const jitter = Math.floor(Math.random() * 1500);
            const delay = baseDelay + jitter;

            // If model fails with 503 twice, Google is experiencing a load spike on this model
            // Dynamically failover to an alternative model in the fallback pool
            if (attempt >= 1) {
              const fallbacks = getModelFallbackChain(activeModel).filter((m) => !triedModels.has(m));
              if (fallbacks.length > 0) {
                const nextModel = fallbacks[0];
                triedModels.add(nextModel.toLowerCase());
                await logger.warn(
                  `Model "${activeModel}" is currently overloaded (503). ` +
                    `⚡ Dynamically switching to healthy alternative "${nextModel}" to finish review without interruption...`,
                );
                activeModel = nextModel;
                break; // Switch model and restart retry attempts
              }
            }

            await logger.warn(
              `Gemini 503 (model overloaded / high demand) (${attempt + 1}/${maxRetries}). Retrying in ${Math.ceil(delay / 1000)}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          // 3. 429 Quota / Rate Limit Hit (RPM or TPM)
          if (isRateLimit && attempt < maxRetries) {
            let delay = fallbackDelays[attempt] || 32000;
            let reason = 'Gemini quota limit hit';

            // Check if Google returned an explicit retryDelay
            const googleDelayMs = extractRetryDelayMs(error);
            if (googleDelayMs !== null && googleDelayMs > 0) {
              // Add 1.5s safety buffer to ensure Google's quota window has fully reset
              delay = Math.min(65000, googleDelayMs + 1500);
              reason = `Gemini quota limit hit (Google requested wait: ${Math.ceil(googleDelayMs / 1000)}s)`;
            } else {
              // Scale according to model RPM pacing with safety margin
              const modelDelay = getModelRequestDelayMs(activeModel);
              delay = Math.max(delay, Math.ceil(modelDelay * 1.25));
            }

            // Dynamic Upgrade / Failover for Constrained Free-Tier Models:
            // - Gemini Pro has only 2 RPM and 32k TPM
            // - Gemma has only 16k TPM
            // - Thinking models have low RPM
            // If requested wait is long (>= 15s) or if repeated 429s occur,
            // dynamically switch to high-capacity Flash (15 RPM, 1M TPM)
            const lowerActive = activeModel.toLowerCase();
            const isConstrained =
              lowerActive.includes('pro') ||
              lowerActive.includes('gemma') ||
              lowerActive.includes('thinking');

            const shouldSwitchModel =
              (isConstrained && (delay >= 15000 || attempt >= 1)) || attempt >= 2;

            if (shouldSwitchModel) {
              const fallbacks = getModelFallbackChain(activeModel).filter((m) => !triedModels.has(m));
              if (fallbacks.length > 0) {
                const targetModel = fallbacks[0];
                triedModels.add(targetModel.toLowerCase());
                await logger.warn(
                  `Model "${activeModel}" hit free-tier rate limits (requested wait: ${Math.ceil(delay / 1000)}s). ` +
                    `⚡ Dynamically switching to "${targetModel}" (15 RPM, 1M TPM) to complete review instantly...`,
                );
                activeModel = targetModel;
                break; // Switch model and restart on new model
              }
            }

            // Temporarily increase adaptive pacing delay for subsequent calls
            adaptiveMultiplier = Math.min(2.0, adaptiveMultiplier + 0.35);

            await logger.warn(
              `${reason} (${attempt + 1}/${maxRetries}). Retrying in ${Math.ceil(delay / 1000)}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (attempt === maxRetries) {
            let message = error.message;
            if (isRateLimit) {
              message =
                `Gemini API quota exceeded for model "${activeModel}". All retry attempts exhausted.\n` +
                `Options:\n` +
                `  1. Wait for quota to reset (1 minute for RPM/TPM, or 24 hours for daily limit)\n` +
                `  2. Switch to a higher-capacity free-tier model (e.g. gemini-2.5-flash or gemini-2.0-flash)\n` +
                `  3. Enable billing on your Google Cloud project\n\n` +
                `Original error: ${error.message}`;
            } else if (isTransient) {
              message =
                `Gemini service is currently unavailable or overloaded across endpoints (503). ` +
                `Please try again shortly.\n\nOriginal error: ${error.message}`;
            }
            throw new Error(message);
          }

          throw error;
        }
      }
    }

    // If we get here, model wasn't found or all endpoints failed
    throw new Error(
      `Model "${activeModel}" was not reachable. ` +
        `Please check your model name. Common options: gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash. ` +
        `Run "gemreview config set model <name>" to change.\n\n` +
        `Original error: ${lastError?.message}`,
    );
  }

  return {
    async review(systemPrompt: string, userPrompt: string): Promise<string> {
      // Execute through queue to serialize and pace requests
      const run = () => executeReview(systemPrompt, userPrompt);
      const nextCall = callQueue.then(run, run);
      callQueue = nextCall.then(() => {}, () => {});
      return nextCall;
    },
    getActiveModel(): string {
      return activeModel;
    },
  };
}
