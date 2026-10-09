import { describe, expect, it } from '@jest/globals';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_RULES,
  isPasswordPolicyConforming,
  validatePassword,
  type PasswordPolicyRuleId,
} from './password-policy';

const CONFORMING_PASSWORD = 'Str0ng!Passphrase';

function unmetRules(password: string): PasswordPolicyRuleId[] {
  return validatePassword(password).map((violation) => violation.rule);
}

describe('password policy rules', () => {
  it('declares the shared rule constants', () => {
    expect(PASSWORD_POLICY.minLength).toBe(12);
    expect(PASSWORD_POLICY.maxLength).toBe(128);
    expect(PASSWORD_POLICY_RULES.map((rule) => rule.id)).toEqual([
      'min_length',
      'max_length',
      'lowercase',
      'uppercase',
      'digit',
      'special',
    ]);
  });

  it('classifies the maximum length as a limit and the rest as requirements', () => {
    const kinds = Object.fromEntries(
      PASSWORD_POLICY_RULES.map((rule) => [rule.id, rule.kind]),
    );

    expect(kinds).toEqual({
      min_length: 'requirement',
      max_length: 'limit',
      lowercase: 'requirement',
      uppercase: 'requirement',
      digit: 'requirement',
      special: 'requirement',
    });
  });
});

describe('validatePassword', () => {
  it('accepts a password satisfying every rule', () => {
    expect(validatePassword(CONFORMING_PASSWORD)).toEqual([]);
    expect(isPasswordPolicyConforming(CONFORMING_PASSWORD)).toBe(true);
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(unmetRules('Abcde1!fghi')).toEqual(['min_length']);
  });

  it('accepts a password of exactly 12 characters', () => {
    expect(unmetRules('Abcde1!fghij')).toEqual([]);
  });

  it('rejects a password longer than 128 characters', () => {
    const longPassword = `${'Aa1!'}${'a'.repeat(126)}`;
    expect(longPassword.length).toBe(130);
    expect(unmetRules(longPassword)).toEqual(['max_length']);
  });

  it('accepts a password of exactly 128 characters', () => {
    const password = `${'Aa1!'}${'a'.repeat(124)}`;
    expect(password.length).toBe(128);
    expect(unmetRules(password)).toEqual([]);
  });

  it('rejects a password without a lowercase letter', () => {
    expect(unmetRules('ABCDEF1!GHIJ')).toEqual(['lowercase']);
  });

  it('rejects a password without an uppercase letter', () => {
    expect(unmetRules('abcdef1!ghij')).toEqual(['uppercase']);
  });

  it('rejects a password without a digit', () => {
    expect(unmetRules('Abcdefg!hijkL')).toEqual(['digit']);
  });

  it('rejects a password without a special character', () => {
    expect(unmetRules('Abcdefg1hijkL')).toEqual(['special']);
  });

  it('rejects an empty password with every other rule unmet', () => {
    expect(unmetRules('')).toEqual([
      'min_length',
      'lowercase',
      'uppercase',
      'digit',
      'special',
    ]);
  });

  it('reports every unmet rule together', () => {
    expect(unmetRules('short')).toEqual([
      'min_length',
      'uppercase',
      'digit',
      'special',
    ]);
  });

  it('includes a human-readable message per violation', () => {
    const [violation] = validatePassword('ABCDEF1!GHIJ');
    expect(violation?.rule).toBe('lowercase');
    expect(violation?.message).toBe(
      'Password must contain at least one lowercase letter',
    );
  });
});
