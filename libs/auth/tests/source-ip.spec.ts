import { describe, expect, it } from '@jest/globals';
import {
  isIpInRange,
  normalizeIp,
  resolveSourceIp,
} from '../infrastructure/source-ip';

describe('resolveSourceIp', () => {
  it('uses the direct peer when no proxy is trusted', () => {
    expect(
      resolveSourceIp({
        remoteAddress: '198.51.100.7',
        forwardedFor: '203.0.113.9',
        trustedProxies: [],
      }),
    ).toBe('198.51.100.7');
  });

  it('ignores forwarded headers from an untrusted direct caller', () => {
    expect(
      resolveSourceIp({
        remoteAddress: '198.51.100.7',
        forwardedFor: '1.2.3.4',
        trustedProxies: ['10.0.0.0/8'],
      }),
    ).toBe('198.51.100.7');
  });

  it('walks the forwarded chain from a trusted proxy to the first untrusted hop', () => {
    expect(
      resolveSourceIp({
        remoteAddress: '10.0.0.5',
        forwardedFor: '203.0.113.9, 10.0.0.4',
        trustedProxies: ['10.0.0.0/8'],
      }),
    ).toBe('203.0.113.9');
  });

  it('falls back to the peer when the whole chain is trusted', () => {
    expect(
      resolveSourceIp({
        remoteAddress: '10.0.0.5',
        forwardedFor: '10.0.0.4, 10.0.0.3',
        trustedProxies: ['10.0.0.0/8'],
      }),
    ).toBe('10.0.0.5');
  });

  it('normalizes IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(
      resolveSourceIp({
        remoteAddress: '::ffff:192.0.2.10',
        trustedProxies: [],
      }),
    ).toBe('192.0.2.10');
  });

  it('supports IPv6 CIDR ranges', () => {
    expect(isIpInRange('2001:db8::5', '2001:db8::/32')).toBe(true);
    expect(isIpInRange('2001:db9::5', '2001:db8::/32')).toBe(false);
  });

  it('returns null without a peer address', () => {
    expect(resolveSourceIp({ trustedProxies: [] })).toBeNull();
  });
});
