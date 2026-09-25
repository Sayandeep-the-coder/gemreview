import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// We need to mock fs for config tests
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    chmodSync: vi.fn(),
  };
});

describe('Config', () => {
  const mockedFs = vi.mocked(fs);

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.GEMREVIEW_GEMINI_KEY;
    delete process.env.GEMREVIEW_GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should apply defaults when no project config exists', async () => {
    const globalConfig = {
      gemini_api_key: 'test-key-123',
      github_token: 'ghp_test456',
      github_base_url: 'https://api.github.com',
    };

    mockedFs.existsSync.mockImplementation((p: any) => {
      const pathStr = String(p);
      if (pathStr.includes('config.json')) return true;
      if (pathStr.includes('.gemreview.json')) return false;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(globalConfig));

    const { loadConfig } = await import('../../src/config/loader.js');
    const config = loadConfig();

    expect(config.dimensions).toEqual(['bugs', 'security', 'tests', 'optimisation']);
    expect(config.severity_threshold).toBe('medium');
    expect(config.max_inline_comments).toBe(20);
    expect(config.gemini_api_key).toBe('test-key-123');
  });

  it('should allow project config to override defaults', async () => {
    const globalConfig = {
      gemini_api_key: 'test-key-123',
      github_token: 'ghp_test456',
      github_base_url: 'https://api.github.com',
    };

    const projectConfig = {
      dimensions: ['bugs', 'security'],
      severity_threshold: 'high',
      max_inline_comments: 5,
    };

    let callCount = 0;
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return JSON.stringify(globalConfig);
      return JSON.stringify(projectConfig);
    });

    const { loadConfig } = await import('../../src/config/loader.js');
    const config = loadConfig();

    expect(config.dimensions).toEqual(['bugs', 'security']);
    expect(config.severity_threshold).toBe('high');
    expect(config.max_inline_comments).toBe(5);
  });

  it('should allow env vars to override project config', async () => {
    process.env.GEMREVIEW_GEMINI_KEY = 'env-key-override';
    process.env.GEMREVIEW_GITHUB_TOKEN = 'env-token-override';

    const globalConfig = {
      gemini_api_key: 'file-key',
      github_token: 'file-token',
      github_base_url: 'https://api.github.com',
    };

    mockedFs.existsSync.mockImplementation((p: any) => {
      const pathStr = String(p);
      if (pathStr.includes('config.json')) return true;
      if (pathStr.includes('.gemreview.json')) return false;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(globalConfig));

    const { loadConfig } = await import('../../src/config/loader.js');
    const config = loadConfig();

    expect(config.gemini_api_key).toBe('env-key-override');
    expect(config.github_token).toBe('env-token-override');
  });

  it('should allow CLI overrides to override everything', async () => {
    const globalConfig = {
      gemini_api_key: 'test-key-123',
      github_token: 'ghp_test456',
      github_base_url: 'https://api.github.com',
    };

    mockedFs.existsSync.mockImplementation((p: any) => {
      const pathStr = String(p);
      if (pathStr.includes('config.json')) return true;
      if (pathStr.includes('.gemreview.json')) return false;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(globalConfig));

    const { loadConfig } = await import('../../src/config/loader.js');
    const config = loadConfig({
      dimensions: ['security'],
      severity_threshold: 'critical',
      model: 'gemini-2.0-flash',
    });

    expect(config.dimensions).toEqual(['security']);
    expect(config.severity_threshold).toBe('critical');
    expect(config.model).toBe('gemini-2.0-flash');
  });

  it('should throw on invalid config with field-level errors', async () => {
    const globalConfig = {
      gemini_api_key: '', // empty = invalid
      github_token: '',   // empty = invalid
      github_base_url: 'not-a-url',
    };

    mockedFs.existsSync.mockImplementation((p: any) => {
      const pathStr = String(p);
      if (pathStr.includes('config.json')) return true;
      if (pathStr.includes('.gemreview.json')) return false;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(globalConfig));

    const { loadConfig } = await import('../../src/config/loader.js');
    expect(() => loadConfig()).toThrow('Invalid configuration');
  });

  it('should throw when global config is missing', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const { loadConfig } = await import('../../src/config/loader.js');
    expect(() => loadConfig()).toThrow('gemreview init');
  });
});
