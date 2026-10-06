#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const allowedPrefixes = ['~', 'workspace:', 'link:', 'file:', 'portal:'];
const allowedProtocols = /^(npm|catalog):/;

const violations = [];
for (const field of dependencyFields) {
  const dependencies = packageJson[field] ?? {};
  for (const [name, specifier] of Object.entries(dependencies)) {
    if (typeof specifier !== 'string') continue;
    if (allowedPrefixes.some((prefix) => specifier.startsWith(prefix))) continue;
    if (allowedProtocols.test(specifier)) continue;
    violations.push({
      field,
      name,
      specifier,
      rule: 'dependency versions must use the "~" prefix',
    });
  }
}

if (violations.length > 0) {
  console.error(JSON.stringify({ status: 'failed', violations }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'passed', violations: [] }, null, 2));
