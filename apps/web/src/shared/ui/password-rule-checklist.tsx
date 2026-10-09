import { useTranslation } from 'react-i18next';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_RULES,
} from '@app/shared/domain/password-policy';
import { cn } from '../lib/cn';

type RuleState = 'met' | 'unmet' | 'neutral';

// Presentational rule checklist fed by the shared password policy module.
// Requirement rules are shown met (green) or unmet (muted) for the current
// value. Limit rules (an upper bound satisfied by default) stay neutral (muted)
// until they are exceeded, when they turn red; they are listed last so the
// always-satisfied constraint does not draw attention.
export function PasswordRuleChecklist({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const orderedRules = [...PASSWORD_POLICY_RULES].sort(
    (a, b) => Number(a.kind === 'limit') - Number(b.kind === 'limit'),
  );

  return (
    <ul
      aria-label={t('passwordRules.title')}
      className={cn('flex flex-col gap-1 text-sm', className)}
    >
      {orderedRules.map((rule) => {
        const satisfied = rule.test(password);
        const state: RuleState =
          rule.kind === 'limit'
            ? satisfied
              ? 'neutral'
              : 'unmet'
            : satisfied
              ? 'met'
              : 'unmet';
        const label = t(`passwordRules.rules.${rule.id}`, {
          min: PASSWORD_POLICY.minLength,
          max: PASSWORD_POLICY.maxLength,
        });
        const stateText =
          state === 'met'
            ? t('passwordRules.met')
            : state === 'unmet'
              ? t('passwordRules.unmet')
              : null;
        const marker = state === 'met' ? '✓' : state === 'neutral' ? '–' : '○';

        return (
          <li
            key={rule.id}
            data-kind={rule.kind}
            data-met={satisfied ? 'true' : 'false'}
            data-state={state}
            aria-label={stateText ? `${label}: ${stateText}` : label}
            className={cn('flex items-center gap-2', toneFor(rule.kind, state))}
          >
            <span aria-hidden="true" className="w-4 text-center">
              {marker}
            </span>
            <span>{label}</span>
            {stateText ? <span className="sr-only">{stateText}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function toneFor(kind: string, state: RuleState): string {
  if (kind === 'requirement' && state === 'met') {
    return 'text-green-700';
  }
  if (kind === 'limit' && state === 'unmet') {
    return 'text-destructive';
  }
  return 'text-muted-foreground';
}
