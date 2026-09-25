/**
 * Test if a Gemini API key is valid by making a cheap API call
 * to list available models.
 */
export async function testGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' }
    );
    return res.status === 200;
  } catch {
    return false;
  }
}
