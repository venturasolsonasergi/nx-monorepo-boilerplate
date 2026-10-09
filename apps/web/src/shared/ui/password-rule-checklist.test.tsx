import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PasswordRuleChecklist } from './password-rule-checklist';
import { PASSWORD_POLICY_RULES } from '@app/shared/domain/password-policy';

afterEach(() => {
  cleanup();
});

describe('PasswordRuleChecklist', () => {
  it('marks every rule unmet for an empty password except the maximum length', () => {
    render(<PasswordRuleChecklist password="" />);

    for (const rule of PASSWORD_POLICY_RULES) {
      const item = screen.getByLabelText(new RegExp(ruleLabel(rule.id)));
      expect(item).toHaveAttribute(
        'data-met',
        rule.id === 'max_length' ? 'true' : 'false',
      );
    }
  });

  it('marks every rule met for a conforming password', () => {
    render(<PasswordRuleChecklist password="Str0ng!Passphrase" />);

    for (const rule of PASSWORD_POLICY_RULES) {
      const item = screen.getByLabelText(new RegExp(ruleLabel(rule.id)));
      expect(item).toHaveAttribute('data-met', 'true');
    }
  });

  it('marks only the satisfied rules met as the user types', () => {
    render(<PasswordRuleChecklist password="onlylower" />);

    expect(screen.getByLabelText(/Una letra minúscula/)).toHaveAttribute(
      'data-met',
      'true',
    );
    expect(screen.getByLabelText(/Una letra mayúscula/)).toHaveAttribute(
      'data-met',
      'false',
    );
    expect(screen.getByLabelText(/Un dígito/)).toHaveAttribute(
      'data-met',
      'false',
    );
    expect(screen.getByLabelText(/Un carácter especial/)).toHaveAttribute(
      'data-met',
      'false',
    );
    expect(screen.getByLabelText(/Al menos 12 caracteres/)).toHaveAttribute(
      'data-met',
      'false',
    );
  });

  it('labels the checklist accessibly and exposes per-rule state', () => {
    render(<PasswordRuleChecklist password="Str0ng!Passphrase" />);

    expect(
      screen.getByRole('list', { name: 'Requisitos de la contraseña' }),
    ).toBeInTheDocument();

    for (const rule of PASSWORD_POLICY_RULES) {
      expect(
        screen.getByText(ruleLabel(rule.id), { exact: false }),
      ).toBeInTheDocument();
    }
  });

  it('lists the maximum-length limit last and neutrally until it is exceeded', () => {
    render(<PasswordRuleChecklist password="Str0ng!Passphrase" />);

    const items = screen.getAllByRole('listitem');
    const last = items.at(-1);
    expect(last).toHaveAttribute('data-kind', 'limit');
    expect(last).toHaveAttribute('data-state', 'neutral');
    expect(last).not.toHaveClass('text-green-700');
  });

  it('turns the maximum-length limit red only when the password is too long', () => {
    render(<PasswordRuleChecklist password={`Aa1!${'a'.repeat(126)}`} />);

    const limit = screen.getByLabelText(/Como máximo 128 caracteres/);
    expect(limit).toHaveAttribute('data-state', 'unmet');
    expect(limit).toHaveClass('text-destructive');
  });
});

function ruleLabel(ruleId: string): string {
  const labels: Record<string, string> = {
    min_length: 'Al menos 12 caracteres',
    max_length: 'Como máximo 128 caracteres',
    lowercase: 'Una letra minúscula',
    uppercase: 'Una letra mayúscula',
    digit: 'Un dígito',
    special: 'Un carácter especial',
  };
  return labels[ruleId] ?? ruleId;
}
