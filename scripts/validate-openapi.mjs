import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const libsDir = join(rootDir, 'libs');

function discoverServices() {
  return readdirSync(libsDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isDirectory() &&
      existsSync(join(libsDir, entry.name, 'microservice.json')),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function parseServiceArg(args) {
  const serviceFlagIndex = args.indexOf('--service');
  if (serviceFlagIndex >= 0) {
    const service = args[serviceFlagIndex + 1];
    if (!service || service.startsWith('--')) {
      throw new Error('Missing service name. Use --service <name>.');
    }
    return service;
  }

  const serviceEqualsArg = args.find((arg) => arg.startsWith('--service='));
  return serviceEqualsArg?.slice('--service='.length);
}

async function main() {
  const availableServices = discoverServices();
  const requestedService = parseServiceArg(process.argv.slice(2));
  const services = requestedService ? [requestedService] : availableServices;

  if (requestedService && !availableServices.includes(requestedService)) {
    throw new Error(
      `Unknown service '${requestedService}'. Available services: ${availableServices.join(', ')}`,
    );
  }

  for (const service of services) {
    const specPath = join(libsDir, service, 'specs', 'openapi.yaml');
    if (!existsSync(specPath)) {
      throw new Error(`[${service}] Missing OpenAPI source at ${relative(rootDir, specPath)}`);
    }

    await SwaggerParser.validate(specPath);
    console.log(`[${service}] ${relative(rootDir, specPath)} is valid`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
