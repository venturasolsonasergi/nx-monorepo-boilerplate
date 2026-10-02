#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const libsDir = path.join(root, 'libs');
const domainRoots = fs
  .readdirSync(libsDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(libsDir, entry.name, 'microservice.json')),
  )
  .map((entry) => path.join('libs', entry.name, 'domain'));
const forbidden = ['@nestjs/', '@prisma/client', 'zod', 'libs/shared/validation'];
const violations = [];

function walk(dir, all = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, all);
    else if (entry.isFile() && full.endsWith('.ts')) all.push(full);
  }
  return all;
}

for (const rel of domainRoots) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const content = fs.readFileSync(file, 'utf8');
    const imports = [...content.matchAll(/from\\s+['\"]([^'\"]+)['\"]/g)].map((m) => m[1]);
    for (const imp of imports) {
      for (const token of forbidden) {
        if (imp.includes(token)) {
          violations.push({ file: path.relative(root, file), import: imp, rule: `domain purity forbids ${token}` });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(JSON.stringify({ status: 'failed', violations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'passed', violations: [] }, null, 2));
