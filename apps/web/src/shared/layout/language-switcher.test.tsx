import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../features/auth', () => ({ useSessionState: vi.fn() }));
vi.mock('../../features/settings', () => ({ useUpdateSettings: vi.fn() }));
vi.mock('../i18n/routing', () => ({ switchLocale: vi.fn() }));

import { useSessionState } from '../../features/auth';
import { useUpdateSettings } from '../../features/settings';
import { switchLocale } from '../i18n/routing';
import { LanguageSwitcher } from './language-switcher';

const mockSession = vi.mocked(useSessionState);
const mockUpdate = vi.mocked(useUpdateSettings);
const mockSwitch = vi.mocked(switchLocale);

let mutateMock: ReturnType<typeof vi.fn>;

function setSession(state: 'unauthenticated' | 'authenticated') {
  mockSession.mockReturnValue({
    state,
    userId: state === 'authenticated' ? 'user-1' : null,
    error: null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  mutateMock = vi.fn();
  mockUpdate.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateSettings>);
  setSession('unauthenticated');
});

afterEach(() => {
  cleanup();
  mockSession.mockReset();
  mockUpdate.mockReset();
  mockSwitch.mockReset();
});

describe('LanguageSwitcher', () => {
  it('changes only the URL when signed out', () => {
    render(<LanguageSwitcher />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'en' },
    });

    expect(mockSwitch).toHaveBeenCalledWith('en', expect.any(String));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('persists the choice before navigating when signed in', () => {
    setSession('authenticated');
    mutateMock.mockImplementation(
      (_input: unknown, options: { onSettled?: () => void }) =>
        options.onSettled?.(),
    );

    render(<LanguageSwitcher />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'ca' },
    });

    const [input, options] = mutateMock.mock.calls[0] as [
      unknown,
      { onSettled?: () => void },
    ];
    expect(input).toEqual({ language: 'ca' });
    expect(typeof options.onSettled).toBe('function');
    expect(mockSwitch).toHaveBeenCalledWith('ca', expect.any(String));
  });

  it('still switches locale when persistence settles without success', () => {
    setSession('authenticated');
    mutateMock.mockImplementation(
      (_input: unknown, options: { onSettled?: () => void }) =>
        options.onSettled?.(),
    );

    render(<LanguageSwitcher />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'en' },
    });

    const [input, options] = mutateMock.mock.calls[0] as [
      unknown,
      { onSettled?: () => void },
    ];
    expect(input).toEqual({ language: 'en' });
    expect(typeof options.onSettled).toBe('function');
    expect(mockSwitch).toHaveBeenCalledWith('en', expect.any(String));
  });
});
