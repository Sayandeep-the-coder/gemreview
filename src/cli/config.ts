import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GLOBAL_CONFIG_KEYS, type GlobalConfigKey } from '../config/defaults.js';

export async function configShowCommand(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const { loadConfig } = await import('../config/loader.js');

  try {
    const config = loadConfig();
    const display: Record<string, unknown> = { ...config };

    // Mask sensitive keys
    if (typeof display.gemini_api_key === 'string' && display.gemini_api_key.length > 4) {
      const key = display.gemini_api_key as string;
      display.gemini_api_key = `****${key.slice(-4)}`;
    }
    if (typeof display.github_token === 'string' && display.github_token.length > 4) {
      const token = display.github_token as string;
      display.github_token = `****${token.slice(-4)}`;
    }

    console.log(chalk.bold('\n  📋 GemReview Configuration\n'));
    console.log(JSON.stringify(display, null, 2));
    console.log('');
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function configSetCommand(key: string, value: string): Promise<void> {
  const chalk = (await import('chalk')).default;

  // Validate key
  if (!GLOBAL_CONFIG_KEYS.includes(key as GlobalConfigKey)) {
    console.error(
      chalk.red(
        `Invalid config key: "${key}". Valid keys: ${GLOBAL_CONFIG_KEYS.join(', ')}`,
      ),
    );
    process.exit(1);
  }

  const configDir = path.join(os.homedir(), '.gemreview');
  const configPath = path.join(configDir, 'config.json');

  // Load existing config
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  }

  // Update key
  config[key] = value;

  // Ensure directory
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // Re-apply chmod 600
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    // chmod may not work on Windows
  }

  console.log(chalk.green(`✅ Updated "${key}" in ${configPath}`));
}
