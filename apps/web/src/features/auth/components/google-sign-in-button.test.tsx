import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';

vi.mock('../api/auth.api', () => ({
  authApi: { getPublicConfig: vi.fn(), startOAuth: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import { GoogleSignInButton } from './google-sign-in-button';

const getPublicConfig = vi.mocked(authApi.getPublicConfig);
const startOAuth = vi.mocked(authApi.startOAuth);

const assign = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { assign },
  });
});

afterEach(() => {
  cleanup();
  assign.mockReset();
  getPublicConfig.mockReset();
  startOAuth.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

function renderButton() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GoogleSignInButton />
    </QueryClientProvider>,
  );
  return client;
}

describe('GoogleSignInButton', () => {
  it('renders the action when the provider is allowed', async () => {
    getPublicConfig.mockResolvedValue({
      supportEmail: null,
      allowedProviders: ['google'],
    });

    renderButton();

    expect(
      await screen.findByRole('button', { name: 'Continuar con Google' }),
    ).toBeInTheDocument();
  });

  it('renders the Google mark next to the label', async () => {
    getPublicConfig.mockResolvedValue({
      supportEmail: null,
      allowedProviders: ['google'],
    });

    renderButton();

    const button = await screen.findByRole('button', {
      name: 'Continuar con Google',
    });
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('disables the action and shows a spinner while starting', async () => {
    getPublicConfig.mockResolvedValue({
      supportEmail: null,
      allowedProviders: ['google'],
    });
    startOAuth.mockReturnValue(new Promise<never>(() => {}));

    renderButton();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Continuar con Google' }),
    );

    const button = await screen.findByRole('button', { name: 'Conectando…' });
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders nothing when no provider is allowed', async () => {
    getPublicConfig.mockResolvedValue({
      supportEmail: null,
      allowedProviders: [],
    });

    renderButton();

    await waitFor(() => expect(getPublicConfig).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: 'Continuar con Google' }),
    ).toBeNull();
  });

  it('renders nothing when the configuration request fails', async () => {
    getPublicConfig.mockRejectedValue(new ApiError(500, 'boom'));

    renderButton();

    await waitFor(() => expect(getPublicConfig).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', { name: 'Continuar con Google' }),
    ).toBeNull();
  });

  it('navigates to the returned authorization URL on success', async () => {
    getPublicConfig.mockResolvedValue({
      supportEmail: null,
      allowedProviders: ['google'],
    });
    startOAuth.mockResolvedValue({
      provider: 'google',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
    });

    renderButton();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Continuar con Google' }),
    );

    await waitFor(() => expect(startOAuth).toHaveBeenCalledWith('google'));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://accounts.google.com/o/oauth2/auth',
      ),
    );
  });

  it('shows a recoverable message and re-enables the action on failure', async () => {
    getPublicConfig.mockResolvedValue({
      supportEmail: null,
      allowedProviders: ['google'],
    });
    startOAuth.mockRejectedValue(new ApiError(400, 'bad'));

    renderButton();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Continuar con Google' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
    );
    expect(assign).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeEnabled();
  });
});
