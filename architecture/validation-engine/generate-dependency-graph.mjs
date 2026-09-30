#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && full.endsWith('.ts')) {
      files.push(full);
    }
  }
}

walk(path.join(root, 'apps'));
walk(path.join(root, 'libs'));

const nodes = files.map((f) => path.relative(root, f));
const edges = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const imports = [...content.matchAll(/from\\s+['\"]([^'\"]+)['\"]/g)].map((m) => m[1]);
  for (const imp of imports) {
    edges.push({ from: path.relative(root, file), to: imp });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  nodes,
  edges,
};

fs.writeFileSync(path.join(root, 'architecture', 'dependency-graph.json'), JSON.stringify(out, null, 2));
console.log('dependency-graph.json updated');
