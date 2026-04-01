import { Command } from 'commander';
import { runCommand } from './run.js';
import { initCommand } from './init.js';
import { configShowCommand, configSetCommand } from './config.js';
import type { Dimension, Severity } from '../gemini/parser.js';

const program = new Command();

program
  .name('gemreview')
  .description('AI-powered CLI PR review bot using Google Gemini')
  .version('1.1.0');

// gemreview init
program
  .command('init')
  .description('Interactive setup — configure API keys and preferences')
  .action(async () => {
    await initCommand();
  });

// gemreview run
program
  .command('run')
  .description('Run an AI-powered review on a GitHub PR')
  .requiredOption('--pr <url>', 'GitHub PR URL (e.g. https://github.com/org/repo/pull/42)')
  .option('--dry-run', 'Preview findings in terminal without posting to GitHub', false)
  .option('--verbose', 'Enable verbose debug output', false)
  .option(
    '--dimensions <dims>',
    'Comma-separated dimensions to review (bugs,security,tests,optimisation)',
    (val: string) => val.split(',') as Dimension[],
  )
  .option(
    '--severity <level>',
    'Minimum severity threshold (low, medium, high, critical)',
  )
  .option('--model <model>', 'Gemini model to use')
  .option(
    '--max-comments <n>',
    'Maximum number of inline comments to post',
    (val: string) => parseInt(val, 10),
  )
  .option('--prompt', 'Generate an AI agent prompt to fix all findings (prints to stdout)')
  .option('--prompt-output <path>', 'Save the agent prompt to a file instead of printing')
  .action(async (opts) => {
    await runCommand({
      pr: opts.pr,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      dimensions: opts.dimensions,
      severity: opts.severity as Severity | undefined,
      model: opts.model,
      maxComments: opts.maxComments,
      prompt: opts.prompt || opts.promptOutput !== undefined,
      promptOutput: opts.promptOutput,
    });
  });

// gemreview config
const configCmd = program
  .command('config')
  .description('View or update GemReview configuration');

configCmd
  .command('show')
  .description('Display current merged configuration')
  .action(async () => {
    await configShowCommand();
  });

configCmd
  .command('set <key> <value>')
  .description('Update a global config value')
  .action(async (key: string, value: string) => {
    await configSetCommand(key, value);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
