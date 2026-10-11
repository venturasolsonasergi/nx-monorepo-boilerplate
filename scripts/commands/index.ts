import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';

import {
  mergeContracts,
  parseContractText,
  serializeContract,
} from '../openapi/merge';
import {
  discoverServices,
  requireServiceArg,
  resolveServicePaths,
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

export function checkPackageVersions(): void {
  runNodeScript('architecture/validation-engine/check-package-versions.mjs');
}

const OPENAPI_ARTIFACT = join(ROOT_DIR, 'apps', 'api', 'openapi.json');

export async function verifyOpenApiArtifact(): Promise<void> {
  if (!existsSync(OPENAPI_ARTIFACT)) {
    throw new Error(
      'OpenAPI artifact apps/api/openapi.json is missing; run pnpm openapi:merge',
    );
  }

  const actual = readFileSync(OPENAPI_ARTIFACT, 'utf8');

  try {
    await SwaggerParser.validate(
      JSON.parse(actual) as Parameters<typeof SwaggerParser.validate>[0],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `OpenAPI artifact apps/api/openapi.json is invalid: ${message}`,
      { cause: error },
    );
  }

  const contracts = discoverServices().map((name) =>
    parseContractText(
      name,
      readFileSync(resolveServicePaths(name).spec, 'utf8'),
    ),
  );
  const expected = serializeContract(mergeContracts(contracts));

  if (actual !== expected) {
    throw new Error(
      'OpenAPI artifact apps/api/openapi.json is stale; run pnpm openapi:merge',
    );
  }

  console.log('OpenAPI artifact apps/api/openapi.json is fresh and valid');
}

const JEST_BIN = join(ROOT_DIR, 'node_modules', 'jest', 'bin', 'jest.js');

export function runContractTests(service?: string): void {
  const services = resolveTargetServices(service);
  runCommand(process.execPath, [
    '--experimental-vm-modules',
    JEST_BIN,
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

const PRISMA_BIN = join(
  ROOT_DIR,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

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

export function prismaMigrate(
  service?: string,
  extraArgs: string[] = [],
): void {
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
