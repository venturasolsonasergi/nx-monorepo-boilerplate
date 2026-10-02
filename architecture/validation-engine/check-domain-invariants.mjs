#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const libsDir = path.join(root, 'libs');
const services = fs.readdirSync(libsDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      fs.existsSync(path.join(libsDir, entry.name, 'microservice.json')),
  )
  .map((entry) => entry.name)
  .sort();
const report = [];
let failed = false;

for (const service of services) {
  const base = path.join(root, 'libs', service, 'domain');
  const domainFiles = fs.existsSync(base)
    ? fs.readdirSync(base).filter((file) => file.endsWith('.ts'))
    : [];
  const valueObjectFiles = domainFiles.filter((file) =>
    file.endsWith('.vo.ts'),
  );
  const domainServiceFiles = domainFiles.filter((file) =>
    file.endsWith('.domain-service.ts'),
  );

  const serviceResult = { service, checks: [] };
  const domainServiceOk = domainServiceFiles.length > 0;
  serviceResult.checks.push({
    check: 'domain services present',
    ok: domainServiceOk,
  });
  if (!domainServiceOk) failed = true;

  const valueObjectOk = valueObjectFiles.length > 0;
  serviceResult.checks.push({
    check: 'value objects present',
    ok: valueObjectOk,
  });
  if (!valueObjectOk) failed = true;

  report.push(serviceResult);
}

if (failed) {
  console.error(JSON.stringify({ status: 'failed', report }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'passed', report }, null, 2));
