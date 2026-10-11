import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';

import { ROOT_DIR } from '../utils/runtime';
import { discoverServices, resolveServicePaths } from '../utils/services';
import { mergeContracts, parseContractText, serializeContract } from './merge';

type ValidationTarget = Parameters<typeof SwaggerParser.validate>[0];

async function main(): Promise<void> {
  const serviceNames = discoverServices();
  console.log(`Discovered services: ${serviceNames.join(', ')}`);

  const contracts = serviceNames.map((name) =>
    parseContractText(
      name,
      readFileSync(resolveServicePaths(name).spec, 'utf8'),
    ),
  );

  const merged = mergeContracts(contracts);

  await SwaggerParser.validate(
    JSON.parse(JSON.stringify(merged)) as ValidationTarget,
  );

  const outputPath = join(ROOT_DIR, 'apps', 'api', 'openapi.json');
  mkdirSync(join(ROOT_DIR, 'apps', 'api'), { recursive: true });
  writeFileSync(outputPath, serializeContract(merged), 'utf8');
  console.log(
    `Wrote merged OpenAPI document to ${relative(ROOT_DIR, outputPath)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
