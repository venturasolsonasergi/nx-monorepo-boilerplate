import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  discoverServices,
  requireServiceArg,
} from '../utils/services';
import {
  ROOT_DIR,
  runCommand,
  runNodeScript,
  utcTimestamp,
} from '../utils/runtime';

export function validateArchitecture(): void {
  runNodeScript('architecture/validation-engine/generate-dependency-graph.mjs');
  runNodeScript('architecture/validation-engine/check-dependencies.mjs');
}

export function validateDomainPurity(): void {
  runNodeScript('architecture/validation-engine/validate-domain-purity.mjs');
}

export function checkDomainInvariants(): void {
  runNodeScript('architecture/validation-engine/check-domain-invariants.mjs');
}

export function checkDependencies(): void {
  runNodeScript('architecture/validation-engine/generate-dependency-graph.mjs');
  runNodeScript('architecture/validation-engine/check-dependencies.mjs');
}

export function runContractTests(service?: string): void {
  const services = resolveTargetServices(service);
  runCommand('pnpm', [
    'jest',
    ...services.map((name) => `libs/${name}/tests`),
    '--runInBand',
  ]);
}

function resolveTargetServices(service?: string): string[] {
  const availableServices = discoverServices();
  if (service && !availableServices.includes(service)) {
    throw new Error(
      `Unknown service '${service}'. Available services: ${availableServices.join(', ')}`,
    );
  }

  return service ? [service] : availableServices;
}

function prismaConfigPath(service: string): string {
  return `libs/${service}/infrastructure/prisma/prisma.config.ts`;
}

const PRISMA_BIN = join(ROOT_DIR, 'node_modules', 'prisma', 'build', 'index.js');

export function prismaGenerate(service?: string): void {
  for (const name of resolveTargetServices(service)) {
    if (!existsSync(join(ROOT_DIR, prismaConfigPath(name)))) {
      continue;
    }

    runCommand('node', [
      PRISMA_BIN,
      'generate',
      '--config',
      prismaConfigPath(name),
    ]);
  }
}

export function prismaMigrate(service?: string, extraArgs: string[] = []): void {
  const [name] = resolveTargetServices(requireServiceArg(service));
  runCommand('node', [
    PRISMA_BIN,
    'migrate',
    'dev',
    '--config',
    prismaConfigPath(name),
    ...extraArgs,
  ]);
}

export function archiveArchitecture(): void {
  const archiveDir = join(ROOT_DIR, 'archive');
  mkdirSync(archiveDir, { recursive: true });
  const target = join(
    archiveDir,
    `architecture-${utcTimestamp().replace(/[-:]/g, '').replace(/\./g, '')}`,
  );
  cpSync(join(ROOT_DIR, 'architecture'), target, { recursive: true });
  console.log('archive completed');
}
