import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export const ROOT_DIR = resolve(__dirname, '..', '..');

export function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function resolveCommand(
  command: string,
  args: string[],
): { executable: string; resolvedArgs: string[] } {
  if (command !== 'pnpm') {
    return { executable: command, resolvedArgs: args };
  }

  const execPath = process.env.npm_execpath;
  if (!execPath) {
    return { executable: 'pnpm', resolvedArgs: args };
  }

  const lower = execPath.toLowerCase();
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.cjs') ||
    lower.endsWith('.mjs')
  ) {
    return { executable: process.execPath, resolvedArgs: [execPath, ...args] };
  }

  return { executable: execPath, resolvedArgs: args };
}

export function runCommand(
  command: string,
  args: string[],
  silent = false,
): void {
  const { executable, resolvedArgs } = resolveCommand(command, args);
  const result = spawnSync(executable, resolvedArgs, {
    cwd: ROOT_DIR,
    stdio: silent ? 'ignore' : 'inherit',
    shell: false,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

export function runCommandOk(command: string, args: string[]): boolean {
  const { executable, resolvedArgs } = resolveCommand(command, args);
  const result = spawnSync(executable, resolvedArgs, {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

export function runNodeScript(relativePath: string, silent = false): void {
  runCommand('node', [relativePath], silent);
}
