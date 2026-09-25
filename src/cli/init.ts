import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  fetchEligibleModels,
  fetchCurrentModel,
  formatTokens,
  type GeminiModelInfo,
} from '../gemini/models.js';

export async function initCommand(): Promise<void> {
  const { password, select, confirm } = await import('@inquirer/prompts');
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  const configDir = path.join(os.homedir(), '.gemreview');
  const configPath = path.join(configDir, 'config.json');

  // Check if config already exists
  let currentModelName: string | undefined;
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      currentModelName = parsed.model;
    } catch {
      // ignore
    }

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

  // Live validation & fetching all eligible models from Google AI Studio
  const spinner = ora('Connecting to Google AI Studio & fetching live models...').start();
  let models: GeminiModelInfo[] = [];
  let currentModelInfo: GeminiModelInfo | undefined;

  try {
    models = await fetchEligibleModels(geminiKey.trim());
    currentModelInfo = await fetchCurrentModel(geminiKey.trim(), currentModelName);
    spinner.succeed(
      chalk.green(`Connected to Google AI Studio! Found ${models.length} eligible generative model(s).`),
    );
  } catch (err: any) {
    spinner.warn(
      chalk.yellow(`Could not fetch live models from AI Studio (${err.message}).`),
    );
  }

  // Display current model and all eligible models with limits
  if (currentModelInfo) {
    console.log(chalk.cyan.bold(`\n  🎯 Current Active Model in Google AI Studio: ${currentModelInfo.id} [${currentModelInfo.quota.family}]`));
    console.log(
      chalk.gray(`     Live Limits: ${formatTokens(currentModelInfo.inputTokenLimit)} context | ${formatTokens(currentModelInfo.outputTokenLimit)} max output | Free Quota: ${currentModelInfo.quota.rpm}, ${currentModelInfo.quota.tpm}, ${currentModelInfo.quota.rpd}`),
    );
  }

  if (models.length > 0) {
    console.log(chalk.bold('\n  📊 Top Recommended Models for PR Code Review:'));
    console.log(chalk.gray('  ' + '─'.repeat(78)));

    const topModels = models.slice(0, 5);
    for (const m of topModels) {
      const isCurrent = currentModelInfo?.id === m.id;
      const currentTag = isCurrent ? chalk.green.bold(' [Current Active Model]') : '';
      const recBadge = m.isRecommended && !isCurrent ? chalk.cyan.bold(' ⭐ [Recommended]') : '';
      const family = chalk.magenta(`[${m.quota.family}]`);
      const id = chalk.bold(m.id.padEnd(24));
      const ctx = chalk.white(`${formatTokens(m.inputTokenLimit)} context`);
      const out = chalk.white(`${formatTokens(m.outputTokenLimit)} max output`);
      const rate = chalk.yellow(`${m.quota.rpm} | ${m.quota.tpm} | ${m.quota.rpd}`);

      console.log(`  ${chalk.green('•')} ${id} ${family}${currentTag}${recBadge}`);
      console.log(`    ${chalk.gray('Limits:')} ${ctx}  ${chalk.gray('|')} ${out}  ${chalk.gray('| Free Quota:')} ${rate}`);
      if (m.description) {
        console.log(`    ${chalk.dim(m.description.slice(0, 100) + (m.description.length > 100 ? '...' : ''))}`);
      }
    }
    console.log(chalk.gray('  ' + '─'.repeat(78)));
    if (models.length > 5) {
      console.log(chalk.gray(`  ↳ Showing top 5 recommended models above. All ${models.length} eligible code models are selectable in the picker below.\n`));
    } else {
      console.log('');
    }
  }

  // Model selection (Immediately following the Gemini API key and model limits overview)
  const choices = models.length > 0
    ? models.map((m) => {
        const isCurrent = currentModelInfo?.id === m.id;
        const currentTag = isCurrent ? ' (Current Active Model)' : '';
        const rec = m.isRecommended && !isCurrent ? ' ⭐ (Recommended)' : '';
        const ctx = formatTokens(m.inputTokenLimit);
        const out = formatTokens(m.outputTokenLimit);
        return {
          name: `${m.id.padEnd(26)} [${ctx} in / ${out} out | ${m.quota.rpm}] (${m.quota.family})${currentTag}${rec}`,
          value: m.id,
          description: `${m.displayName} — ${m.description || ''} | Limits: ${ctx} context, ${out} output tokens | Quota: ${m.quota.rpm}, ${m.quota.tpm}, ${m.quota.rpd}`,
        };
      })
    : [
        { name: 'gemini-2.5-flash (1M in / 8k out | 15 RPM) [Gemini Flash] ⭐', value: 'gemini-2.5-flash' },
        { name: 'gemini-2.5-pro   (2M in / 8k out | 2 RPM)  [Gemini Pro]', value: 'gemini-2.5-pro' },
        { name: 'gemma-4-31b-it   (262k in / 32k out | 30 RPM) [Gemma Open Model]', value: 'gemma-4-31b-it' },
      ];

  const defaultSelection = currentModelInfo?.id || models[0]?.id || 'gemini-2.5-flash';

  const model = await select({
    message: `Choose your AI model from Google AI Studio (Current: ${defaultSelection}):`,
    choices,
    default: defaultSelection,
  });

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

  // Write config
  const config = {
    gemini_api_key: geminiKey.trim(),
    github_token: githubToken.trim(),
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
