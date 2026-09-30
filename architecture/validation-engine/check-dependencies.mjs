#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [
  'libs/users/domain',
  'libs/users/application',
  'libs/users/infrastructure',
  'libs/orders/domain',
  'libs/orders/application',
  'libs/orders/infrastructure',
];

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

const violations = [];
for (const rel of targets) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const layer = rel.includes('/domain') ? 'domain' : rel.includes('/application') ? 'application' : 'infrastructure';
  for (const file of walk(abs)) {
    const imports = scanFile(file);
    for (const imp of imports) {
      for (const token of forbiddenByLayer[layer] ?? []) {
        if (imp.includes(token)) {
          violations.push({ file: path.relative(root, file), import: imp, rule: `${layer} forbids ${token}` });
        }
      }
      if (layer === 'domain' && imp.includes('/orders/domain') && file.includes('libs/users/domain')) {
        violations.push({ file: path.relative(root, file), import: imp, rule: 'cross microservice domain import forbidden' });
      }
      if (layer === 'domain' && imp.includes('/users/domain') && file.includes('libs/orders/domain')) {
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
