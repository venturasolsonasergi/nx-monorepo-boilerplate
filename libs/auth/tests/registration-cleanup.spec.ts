import { describe, expect, it, jest } from '@jest/globals';
import { RegistrationCleanupService } from '../infrastructure/registration-cleanup.service';
import type { AuthConfig } from '../infrastructure/auth.config';

const FAKE_CONFIG: AuthConfig = {
  secret: 'secret',
  baseURL: 'http://localhost',
  webURL: 'http://localhost:4200',
  basePath: '/auth',
  trustedOrigins: ['http://localhost:4200'],
  allowedProviders: [],
  socialProviders: {},
  isProduction: false,
  supportEmail: null,
  smtp: null,
  verificationLimits: {
    resendWindowSeconds: 60,
    sourceWindowSeconds: 3600,
    sourceMax: 20,
    retentionSeconds: 86400,
  },
  trustedProxies: [],
};

function createService(
  deleteExpired: jest.Mock,
  deleteOlderThan: jest.Mock,
): RegistrationCleanupService {
  const registrations = {
    findByEmail: jest.fn(),
    findByTokenHash: jest.fn(),
    resolveForRequest: jest.fn(),
    saveTokenHash: jest.fn(),
    consume: jest.fn(),
    deleteExpired,
  };
  const throttle = {
    reserve: jest.fn(),
    deleteOlderThan,
  };

  return new RegistrationCleanupService(
    { $transaction: jest.fn() } as never,
    registrations,
    throttle,
    FAKE_CONFIG,
  );
}

describe('RegistrationCleanupService', () => {
  it('deletes expired registrations and stale throttle rows', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const deleteExpired = jest.fn().mockResolvedValue(0);
    const deleteOlderThan = jest.fn().mockResolvedValue(0);

    const service = createService(deleteExpired, deleteOlderThan);
    await service.execute(now);

    expect(deleteExpired).toHaveBeenCalledWith(now);
    expect(deleteOlderThan).toHaveBeenCalledWith(
      new Date(now.getTime() - 86400_000),
    );
  });

  it('logs a failed pass without rejecting and runs again later', async () => {
    const deleteExpired = jest
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(1);
    const deleteOlderThan = jest.fn().mockResolvedValue(0);

    const service = createService(deleteExpired, deleteOlderThan);

    await expect(service.runSafely()).resolves.toBeUndefined();
    await service.runSafely();

    expect(deleteExpired).toHaveBeenCalledTimes(2);
  });

  it('does not overlap a still-running pass', async () => {
    const deleteExpired = jest.fn();
    const deleteOlderThan = jest.fn().mockResolvedValue(0);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    deleteExpired.mockImplementationOnce(() => gate);

    const service = createService(deleteExpired, deleteOlderThan);

    const first = service.runSafely();
    const second = service.runSafely();
    release();
    await Promise.all([first, second]);

    expect(deleteExpired).toHaveBeenCalledTimes(1);
  });
});
