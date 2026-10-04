import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// Routes like /users and /auth/oauth/callback are both API prefixes and SPA
// routes. Only proxy actual API calls; let the browser's HTML navigations fall
// through to the SPA so a direct visit or reload renders the client.
function isHtmlNavigation(req: IncomingMessage) {
  return (req.headers.accept ?? '').includes('text/html');
}

const apiProxy = {
  target: apiTarget,
  changeOrigin: false,
  bypass: (req: IncomingMessage) =>
    isHtmlNavigation(req) ? '/index.html' : undefined,
};

export default defineConfig({
  root: dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  server: {
    port: 4200,
    proxy: {
      '/auth': apiProxy,
      '/users': apiProxy,
      '/orders': apiProxy,
    },
  },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    reporters: ['default'],
  },
});
