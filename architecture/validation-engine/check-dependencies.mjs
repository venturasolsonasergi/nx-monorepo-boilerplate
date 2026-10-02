#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const libsDir = path.join(root, 'libs');
const services = fs
  .readdirSync(libsDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(libsDir, entry.name, 'microservice.json')),
  )
  .map((entry) => entry.name)
  .sort();

const targets = services.flatMap((service) => [
  `libs/${service}/domain`,
  `libs/${service}/application`,
  `libs/${service}/infrastructure`,
]);

const forbiddenByLayer = {
  domain: ['@nestjs/', '@prisma/client', 'zod', 'src/shared/validation'],
  application: ['@prisma/client'],
};

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [...content.matchAll(/from\\s+['\"]([^'\"]+)['\"]/g)].map((m) => m[1]);
  return imports;
}

function walk(dir, all = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, all);
    } else if (entry.isFile() && full.endsWith('.ts')) {
      all.push(full);
    }
  }
  return all;
}

function referencesForeignDomain(imp, currentService) {
  return services.some(
    (service) =>
      service !== currentService &&
      (imp.includes(`/libs/${service}/domain`) ||
        imp.includes(`/${service}/domain/`)),
  );
}

const violations = [];
for (const rel of targets) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const currentService = rel.split('/')[1];
  const layer = rel.includes('/domain') ? 'domain' : rel.includes('/application') ? 'application' : 'infrastructure';
  for (const file of walk(abs)) {
    const imports = scanFile(file);
    for (const imp of imports) {
      for (const token of forbiddenByLayer[layer] ?? []) {
        if (imp.includes(token)) {
          violations.push({ file: path.relative(root, file), import: imp, rule: `${layer} forbids ${token}` });
        }
      }
      if (layer === 'domain' && referencesForeignDomain(imp, currentService)) {
        violations.push({ file: path.relative(root, file), import: imp, rule: 'cross microservice domain import forbidden' });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(JSON.stringify({ status: 'failed', violations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'passed', violations: [] }, null, 2));
