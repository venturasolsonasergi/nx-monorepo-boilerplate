import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const service of ['users', 'orders']) {
  const source = path.join(
    root,
    'libs',
    service,
    'infrastructure',
    'prisma',
    'generated',
    'client',
  );
  const destination = path.join(
    root,
    'dist',
    'libs',
    service,
    'infrastructure',
    'prisma',
    'generated',
    'client',
  );

  if (!fs.existsSync(source)) {
    throw new Error(`Missing generated Prisma client for ${service}; run pnpm prisma:generate`);
  }

  fs.cpSync(source, destination, { recursive: true, force: true });
}