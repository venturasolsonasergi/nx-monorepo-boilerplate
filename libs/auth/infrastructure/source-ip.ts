import { isIP } from 'node:net';
import type { Request } from 'express';

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function normalizeIp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  let ip = value.trim();
  if (ip.length === 0) {
    return null;
  }

  const zoneIndex = ip.indexOf('%');
  if (zoneIndex >= 0) {
    ip = ip.slice(0, zoneIndex);
  }

  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) {
    ip = mapped[1];
  }

  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }

  if (IPV4_PATTERN.test(ip)) {
    const octets = ip.split('.').map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255) ? ip : null;
  }

  return isIP(ip) === 6 ? ip : null;
}

interface IpValue {
  value: bigint;
  bits: number;
}

function ipToBigInt(ip: string): IpValue | null {
  if (isIP(ip) === 4) {
    const value = ip
      .split('.')
      .map(Number)
      .reduce((accumulator, octet) => (accumulator << 8n) + BigInt(octet), 0n);
    return { value, bits: 32 };
  }

  if (isIP(ip) === 6) {
    const [head, tail] = ip.includes('::') ? ip.split('::') : [ip, ''];
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = 8 - (headParts.length + tailParts.length);
    if (missing < 0 || (ip.includes('::') && missing === 0)) {
      return null;
    }

    const groups = [
      ...headParts,
      ...Array<string>(missing).fill('0'),
      ...tailParts,
    ];
    if (groups.length !== 8) {
      return null;
    }

    let value = 0n;
    for (const group of groups) {
      const parsed = parseInt(group || '0', 16);
      if (Number.isNaN(parsed)) {
        return null;
      }
      value = (value << 16n) + BigInt(parsed);
    }
    return { value, bits: 128 };
  }

  return null;
}

interface CidrRange {
  base: bigint;
  bits: number;
  prefix: number;
}

function parseCidr(cidr: string): CidrRange | null {
  const [address, prefixRaw] = cidr.split('/');
  const parsed = address ? ipToBigInt(address) : null;
  if (!parsed) {
    return null;
  }

  const prefix =
    prefixRaw === undefined ? parsed.bits : Number.parseInt(prefixRaw, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > parsed.bits) {
    return null;
  }

  const shift = BigInt(parsed.bits - prefix);
  const base = shift === 0n ? parsed.value : (parsed.value >> shift) << shift;

  return { base, bits: parsed.bits, prefix };
}

export function isIpInRange(ip: string, cidr: string): boolean {
  const normalized = normalizeIp(ip);
  const target = normalized ? ipToBigInt(normalized) : null;
  const range = parseCidr(cidr);
  if (!target || !range || target.bits !== range.bits) {
    return false;
  }

  const span = (1n << BigInt(range.bits - range.prefix)) - 1n;
  return target.value >= range.base && target.value <= range.base + span;
}

export function resolveSourceIp(input: {
  remoteAddress?: string;
  forwardedFor?: string;
  trustedProxies: string[];
}): string | null {
  const remote = normalizeIp(input.remoteAddress);
  const trusted = input.trustedProxies
    .map((cidr) => cidr.trim())
    .filter((cidr) => cidr.length > 0);

  if (!remote) {
    return null;
  }

  if (trusted.length === 0) {
    return remote;
  }

  if (!trusted.some((cidr) => isIpInRange(remote, cidr))) {
    return remote;
  }

  const chain = (input.forwardedFor ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const candidate = normalizeIp(chain[index]);
    if (!candidate) {
      return remote;
    }
    if (trusted.some((cidr) => isIpInRange(candidate, cidr))) {
      continue;
    }
    return candidate;
  }

  return remote;
}

export function sourceIpFromRequest(
  request: Request,
  trustedProxies: string[],
): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwarded)
    ? forwarded.join(',')
    : forwarded;

  return resolveSourceIp({
    remoteAddress: request.socket?.remoteAddress ?? request.ip,
    forwardedFor,
    trustedProxies,
  });
}
