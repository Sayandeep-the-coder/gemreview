import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export async function initCommand(): Promise<void> {
  const { password, select, confirm } = await import('@inquirer/prompts');
  const chalk = (await import('chalk')).default;

  const configDir = path.join(os.homedir(), '.gemreview');
  const configPath = path.join(configDir, 'config.json');

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    const overwrite = await confirm({
      message: 'Configuration already exists. Do you want to overwrite it?',
      default: false,
    });

    if (!overwrite) {
      console.log(chalk.yellow('Aborted. Existing configuration preserved.'));
      return;
    }
  }

  console.log(chalk.bold('\n  🔧 GemReview Setup\n'));

  // Gemini API key
  const geminiKey = await password({
    message: 'Enter your Gemini API key:',
    mask: '*',
    validate: (value: string) => {
      if (!value || value.trim().length === 0) {
        return 'API key is required. Get one at https://aistudio.google.com/app/apikey';
      }
      return true;
    },
  });
  console.log(chalk.gray('  ↳ Get one free at https://aistudio.google.com/app/apikey'));

  // GitHub token
  const githubToken = await password({
    message: 'Enter your GitHub personal access token:',
    mask: '*',
    validate: (value: string) => {
      if (!value || value.trim().length === 0) {
        return 'GitHub token is required. Create one at https://github.com/settings/tokens';
      }
      return true;
    },
  });
  console.log(
    chalk.gray(
      '  ↳ Needs repo scope. Create at https://github.com/settings/tokens',
    ),
  );

  // Model selection
  const model = await select({
    message: 'Choose your preferred Gemini model:',
    choices: [
      { name: 'gemini-2.5-flash  ⚡ (Recommended — fast, high quality, best free-tier quota)', value: 'gemini-2.5-flash' },
      { name: 'gemini-2.5-pro   🧠 (Highest quality, slower, lower quota)', value: 'gemini-2.5-pro' },
      { name: 'gemini-2.0-flash  🚀 (Fast, good quality)', value: 'gemini-2.0-flash' },
    ],
  });

  // Write config
  const config = {
    gemini_api_key: geminiKey,
    github_token: githubToken,
    github_base_url: 'https://api.github.com',
    model,
  };

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // Set restrictive permissions (chmod 600)
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    // chmod may not work on Windows, but we still try
  }

  console.log(chalk.green(`\n  ✅ Config saved to ${configPath}`));
  console.log(
    chalk.gray(`  Default model set to: ${model}`),
  );
  console.log(
    chalk.gray('  You can override per-project with .gemreview.json\n'),
  );
}
