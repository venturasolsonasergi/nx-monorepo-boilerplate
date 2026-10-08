import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from './shared/i18n/config';
import { resolveInitialLocale } from './shared/i18n/routing';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element (#root) not found in index.html');
}

// Resolve the locale from the URL (or a prefix-less request) before mounting so
// every route is served under a locale prefix, then create the router with that
// locale as its basepath.
async function start() {
  const locale = await resolveInitialLocale();
  await i18n.changeLanguage(locale);

  const [{ App }, { createAppRouter }] = await Promise.all([
    import('./app/app'),
    import('./app/router'),
  ]);

  createRoot(rootElement as HTMLElement).render(
    <StrictMode>
      <App router={createAppRouter(`/${locale}`)} />
    </StrictMode>,
  );
}

void start();
