import { describe, expect, it } from '@jest/globals';
import {
  PendingRegistration,
  REGISTRATION_TTL_SECONDS,
} from '../domain/pending-registration';
import { RegistrationToken } from '../domain/registration-token.vo';

const INITIATED_AT = new Date('2026-01-01T00:00:00.000Z');

function atSecondsAfterInitiation(seconds: number): Date {
  return new Date(INITIATED_AT.getTime() + seconds * 1000);
}

describe('PendingRegistration', () => {
  it('expires exactly 48 hours after initiation', () => {
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'Ada@Example.com',
      initiatedAt: INITIATED_AT,
    });

    expect(REGISTRATION_TTL_SECONDS).toBe(172800);
    expect(registration.email).toBe('ada@example.com');
    expect(registration.expiresAt).toEqual(
      atSecondsAfterInitiation(REGISTRATION_TTL_SECONDS),
    );
  });

  it('is active one second before the deadline', () => {
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    }).withTokenHash('hash-1');

    const now = atSecondsAfterInitiation(REGISTRATION_TTL_SECONDS - 1);

    expect(registration.isExpired(now)).toBe(false);
    expect(registration.isActive(now)).toBe(true);
    expect(registration.acceptsToken('hash-1', now)).toBe(true);
  });

  it('is expired at exactly the deadline', () => {
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    }).withTokenHash('hash-1');

    const now = atSecondsAfterInitiation(REGISTRATION_TTL_SECONDS);

    expect(registration.isExpired(now)).toBe(true);
    expect(registration.isActive(now)).toBe(false);
    expect(registration.acceptsToken('hash-1', now)).toBe(false);
  });

  it('is expired after the deadline', () => {
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    }).withTokenHash('hash-1');

    const now = atSecondsAfterInitiation(REGISTRATION_TTL_SECONDS + 1);

    expect(registration.isExpired(now)).toBe(true);
    expect(registration.acceptsToken('hash-1', now)).toBe(false);
  });

  it('rejects a token that does not match the current hash', () => {
    const now = atSecondsAfterInitiation(60);
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    }).withTokenHash('hash-1');

    expect(registration.acceptsToken('other-hash', now)).toBe(false);
  });

  it('rejects a token when no token has been prepared', () => {
    const now = atSecondsAfterInitiation(60);
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    });

    expect(registration.acceptsToken('hash-1', now)).toBe(false);
  });

  it('rejects a token once consumed', () => {
    const now = atSecondsAfterInitiation(60);
    const registration = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    })
      .withTokenHash('hash-1')
      .withConsumedAt(now);

    expect(registration.isConsumed()).toBe(true);
    expect(registration.isActive(now)).toBe(false);
    expect(registration.acceptsToken('hash-1', now)).toBe(false);
  });

  it('makes old links unusable after a restart', () => {
    const now = atSecondsAfterInitiation(REGISTRATION_TTL_SECONDS + 5);

    const replaced = PendingRegistration.initiate({
      id: 'reg-old',
      email: 'ada@example.com',
      initiatedAt: INITIATED_AT,
    }).withTokenHash('old-hash');

    const restarted = PendingRegistration.initiate({
      id: 'reg-new',
      email: 'ada@example.com',
      initiatedAt: now,
    }).withTokenHash('new-hash');

    expect(replaced.isExpired(now)).toBe(true);
    expect(restarted.acceptsToken('old-hash', now)).toBe(false);
    expect(restarted.acceptsToken('new-hash', now)).toBe(true);
  });
});

describe('RegistrationToken', () => {
  it('hashes deterministically with sha-256', () => {
    const hash = RegistrationToken.hash('token-value');

    expect(hash).toHaveLength(64);
    expect(RegistrationToken.hash('token-value')).toBe(hash);
  });

  it('generates distinct high-entropy tokens', () => {
    const first = RegistrationToken.generate();
    const second = RegistrationToken.generate();

    expect(first.value).not.toBe(second.value);
    expect(first.value.length).toBeGreaterThanOrEqual(43);
    expect(first.hash).toHaveLength(64);
  });
});
