const SENSITIVE_KEYS: string[] = [];

export function registerSensitiveKeys(keys: string[]): void {
  for (const key of keys) {
    if (key && key.length > 0 && !SENSITIVE_KEYS.includes(key)) {
      SENSITIVE_KEYS.push(key);
    }
  }
}

export function maskKeys(text: string): string {
  let masked = text;
  for (const key of SENSITIVE_KEYS) {
    if (key && key.length > 4) {
      masked = masked.replaceAll(key, '[REDACTED]');
    }
  }
  return masked;
}

let verboseEnabled = false;

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

async function getChalk() {
  const chalk = (await import('chalk')).default;
  return chalk;
}

export async function log(message: string): Promise<void> {
  console.log(maskKeys(message));
}

export async function success(message: string): Promise<void> {
  const chalk = await getChalk();
  console.log(chalk.green(maskKeys(message)));
}

export async function warn(message: string): Promise<void> {
  const chalk = await getChalk();
  console.warn(chalk.yellow(maskKeys(message)));
}

export async function error(message: string): Promise<void> {
  const chalk = await getChalk();
  console.error(chalk.red(maskKeys(message)));
}

export async function debug(message: string): Promise<void> {
  if (!verboseEnabled && !process.env.GEMREVIEW_VERBOSE) {
    return;
  }
  const chalk = await getChalk();
  console.log(chalk.gray(`[DEBUG] ${maskKeys(message)}`));
}
