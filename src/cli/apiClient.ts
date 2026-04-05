import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// API base URL priority: config file → env var → production default
function resolveApiBaseUrl(): string {
  // 1. Check env var
  if (process.env.GEMREVIEW_API_URL) return process.env.GEMREVIEW_API_URL;
  // 2. Check config file
  try {
    const configPath = path.join(os.homedir(), '.gemreview', 'config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw) as Record<string, unknown>;
      if (config.api_url && typeof config.api_url === 'string') return config.api_url;
    }
  } catch { /* ignore */ }
  // 3. Default to production
  return 'https://gemreview-api.onrender.com';
}

export const API_BASE_URL = resolveApiBaseUrl();

interface RequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  token?: string;
}

/**
 * Lightweight HTTP client for CLI → GemReview API communication.
 * Automatically attaches JWT or API key from config.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  // Resolve auth token: explicit param → config → error
  let authToken = token?.trim();
  if (!authToken) {
    authToken = loadTokenFromConfig()?.trim();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle non-JSON or error responses gracefully
  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let data: any;
  if (isJson) {
    try {
      data = await res.json();
    } catch (err) {
      throw new Error(`Failed to parse JSON response from ${url}: ${res.status} ${res.statusText}`);
    }
  } else {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `API request failed: ${res.status} ${res.statusText}\n${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`
      );
    }
    // If it's OK but not JSON (unexpected), just try to parse if possible or return as is
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }
  }

  if (!res.ok) {
    throw new Error(
      data?.error ?? `API request failed: ${res.status} ${res.statusText}`,
    );
  }

  return data as T;
}

/** Load the GemReview JWT from ~/.gemreview/config.json */
function loadTokenFromConfig(): string | undefined {
  try {
    const configPath = path.join(os.homedir(), '.gemreview', 'config.json');
    if (!fs.existsSync(configPath)) return undefined;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown>;
    return config.gemreview_token as string | undefined;
  } catch {
    return undefined;
  }
}

/** Save a key-value pair to ~/.gemreview/config.json */
export function saveToConfig(key: string, value: unknown): void {
  const configDir  = path.join(os.homedir(), '.gemreview');
  const configPath = path.join(configDir, 'config.json');

  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  }

  config[key] = value;

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  try { fs.chmodSync(configPath, 0o600); } catch { /* Windows */ }
}

/** Remove a key from ~/.gemreview/config.json */
export function removeFromConfig(key: string): void {
  const configPath = path.join(os.homedir(), '.gemreview', 'config.json');
  if (!fs.existsSync(configPath)) return;

  const raw    = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw) as Record<string, unknown>;
  delete config[key];

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/** Read a value from ~/.gemreview/config.json */
export function readFromConfig(key: string): unknown {
  try {
    const configPath = path.join(os.homedir(), '.gemreview', 'config.json');
    if (!fs.existsSync(configPath)) return undefined;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown>;
    return config[key];
  } catch {
    return undefined;
  }
}
