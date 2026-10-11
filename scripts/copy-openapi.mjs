import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'apps', 'api', 'openapi.json');
const destinationDir = path.join(root, 'dist', 'apps', 'api');
const destination = path.join(destinationDir, 'openapi.json');

if (!fs.existsSync(source)) {
  throw new Error('Missing merged OpenAPI document; run pnpm openapi:merge');
}

fs.mkdirSync(destinationDir, { recursive: true });
fs.copyFileSync(source, destination);
