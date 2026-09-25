export async function createSpinner(text: string) {
  const { default: ora } = await import('ora');
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}
