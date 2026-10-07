import { describe, expect, it, jest } from '@jest/globals';
import { RegistrationActivationPrismaAdapter } from '../infrastructure/registration-activation.prisma';
import { InvalidVerificationTokenError } from '../application/auth.errors';

const EXPIRES_AT = new Date('2026-01-02T23:59:59.000Z');

function row() {
  return {
    id: 'reg-1',
    email: 'ada@example.com',
    expires_at: EXPIRES_AT,
    token_hash: 'hash-1',
    consumed_at: null,
  };
}

describe('RegistrationActivationPrismaAdapter', () => {
  it('rejects an unknown token before hashing or opening a transaction', async () => {
    const prisma = {
      pendingRegistration: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };
    const adapter = new RegistrationActivationPrismaAdapter(
      prisma as never,
      clock,
    );

    await expect(
      adapter.activate({ tokenHash: 'invented', password: 'password123' }),
    ).rejects.toBeInstanceOf(InvalidVerificationTokenError);

    expect(prisma.pendingRegistration.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a registration whose deadline passes while the caller waits for the lock', async () => {
    const prisma = {
      pendingRegistration: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reg-1',
          email: 'ada@example.com',
          expiresAt: EXPIRES_AT,
          consumedAt: null,
        }),
      },
      $transaction: jest.fn(async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          $queryRaw: jest.fn().mockResolvedValue([row()]),
          user: {},
          account: {},
          pendingRegistration: {},
        }),
      ),
    };
    // First call (preliminary) is before the deadline; second call is taken
    // after the lock and is now past it.
    const clock = {
      now: jest
        .fn<() => Date>()
        .mockReturnValueOnce(new Date('2026-01-01T00:00:00.000Z'))
        .mockReturnValue(new Date('2026-01-03T00:00:00.000Z')),
    };
    const adapter = new RegistrationActivationPrismaAdapter(
      prisma as never,
      clock,
    );

    await expect(
      adapter.activate({ tokenHash: 'hash-1', password: 'password123' }),
    ).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });
});
