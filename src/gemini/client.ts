import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from '../output/logger.js';

export interface GeminiClient {
  review(systemPrompt: string, userPrompt: string): Promise<string>;
}

export function createGeminiClient(apiKey: string, model: string): GeminiClient {
  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    async review(systemPrompt: string, userPrompt: string): Promise<string> {
      // Try v1beta first (supports systemInstruction), then fall back to v1
      const apiVersions = ['v1beta', 'v1'];
      let lastError: Error | null = null;

      for (const apiVersion of apiVersions) {
        const geminiModel = genAI.getGenerativeModel(
          {
            model,
            ...(apiVersion === 'v1beta' ? { systemInstruction: systemPrompt } : {}),
          },
          { apiVersion },
        );

        const maxRetries = 5;
        const baseDelays = [1000, 2000, 4000, 8000, 16000];

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // For v1, prepend system prompt to user prompt since systemInstruction isn't supported
            const userContent =
              apiVersion === 'v1'
                ? `${systemPrompt}\n\n---\n\n${userPrompt}`
                : userPrompt;

            const result = await geminiModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: userContent }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
                maxOutputTokens: 4096,
              },
            });

            const response = result.response;
            const text = response.text();
            return text;
          } catch (error: any) {
            const isNotFound =
              error.status === 404 ||
              error.message?.includes('404') ||
              error.message?.includes('is not found');

            const isRateLimit =
              error.status === 429 ||
              error.message?.includes('429') ||
              error.message?.includes('RESOURCE_EXHAUSTED') ||
              error.message?.includes('Quota exceeded');

            // If model not found on this API version, break and try next version
            if (isNotFound) {
              lastError = error;
              await logger.debug(
                `Model "${model}" not found on ${apiVersion} endpoint. Trying next...`,
              );
              break;
            }

            if (isRateLimit && attempt < maxRetries) {
              const delay = baseDelays[attempt] || 16000;
              await logger.warn(
                `Gemini quota limit hit (${attempt + 1}/${maxRetries}). Retrying in ${Math.ceil(delay / 1000)}s...`,
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }

            if (attempt === maxRetries) {
              let message = error.message;
              if (isRateLimit) {
                message = `Gemini API quota exceeded. Your free-tier daily limit has been reached. Options:\n  1. Wait for quota to reset (usually 24 hours)\n  2. Create a new API key in a new Google Cloud project\n  3. Enable billing on your Google Cloud project\n\nOriginal error: ${error.message}`;
              }
              throw new Error(message);
            }

            throw error;
          }
        }
      }

      // If we get here, model wasn't found on any API version
      throw new Error(
        `Model "${model}" was not found on any API version (v1beta, v1). ` +
          `Please check your model name. Common options: gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash-002. ` +
          `Run "gemreview config set model <name>" to change.\n\n` +
          `Original error: ${lastError?.message}`,
      );
    },
  };
}
