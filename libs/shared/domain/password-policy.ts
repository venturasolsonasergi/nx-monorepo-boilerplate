export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
} as const;

export type PasswordPolicyRuleId =
  'min_length' | 'max_length' | 'lowercase' | 'uppercase' | 'digit' | 'special';

// Requirement rules are goals the password must reach; limit rules are an upper
// bound that is satisfied by default and only becomes relevant when exceeded, so
// the checklist can present them neutrally until they are violated.
export type PasswordPolicyRuleKind = 'requirement' | 'limit';

export interface PasswordPolicyRule {
  id: PasswordPolicyRuleId;
  kind: PasswordPolicyRuleKind;
  test(password: string): boolean;
}

export interface PasswordPolicyViolation {
  rule: PasswordPolicyRuleId;
  message: string;
}

const RULE_MESSAGES: Record<PasswordPolicyRuleId, string> = {
  min_length: `Password must be at least ${PASSWORD_POLICY.minLength} characters long`,
  max_length: `Password must be at most ${PASSWORD_POLICY.maxLength} characters long`,
  lowercase: 'Password must contain at least one lowercase letter',
  uppercase: 'Password must contain at least one uppercase letter',
  digit: 'Password must contain at least one digit',
  special: 'Password must contain at least one special character',
};

export const PASSWORD_POLICY_RULES: readonly PasswordPolicyRule[] = [
  {
    id: 'min_length',
    kind: 'requirement',
    test: (password) => password.length >= PASSWORD_POLICY.minLength,
  },
  {
    id: 'max_length',
    kind: 'limit',
    test: (password) => password.length <= PASSWORD_POLICY.maxLength,
  },
  {
    id: 'lowercase',
    kind: 'requirement',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'uppercase',
    kind: 'requirement',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'digit',
    kind: 'requirement',
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: 'special',
    kind: 'requirement',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function validatePassword(password: string): PasswordPolicyViolation[] {
  return PASSWORD_POLICY_RULES.filter((rule) => !rule.test(password)).map(
    (rule) => ({ rule: rule.id, message: RULE_MESSAGES[rule.id] }),
  );
}

export function isPasswordPolicyConforming(password: string): boolean {
  return validatePassword(password).length === 0;
}
