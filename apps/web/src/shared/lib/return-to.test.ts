import { describe, expect, it } from 'vitest';
import { authorizedReturnTo, DASHBOARD_DESTINATION } from './return-to';

describe('authorizedReturnTo', () => {
  it('accepts only the exact /dashboard value', () => {
    expect(authorizedReturnTo('/dashboard')).toBe(DASHBOARD_DESTINATION);
  });

  it.each([
    undefined,
    null,
    '',
    '/users',
    '/',
    'https://evil.example.com',
    '//evil.example.com',
    '/dashboard?next=/users',
    '/dashboard/extra',
    ' /dashboard',
    '/DASHBOARD',
  ])('discards the unauthorized value %s', (value) => {
    expect(authorizedReturnTo(value)).toBeNull();
  });
});
