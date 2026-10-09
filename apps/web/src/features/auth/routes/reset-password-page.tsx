import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { isPasswordPolicyConforming } from '@app/shared/domain/password-policy';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { PasswordRuleChecklist } from '../../../shared/ui/password-rule-checklist';
import { authApi } from '../api/auth.api';
import { resetErrorMessage } from '../lib/auth-messages';

// Landed here from the emailed reset link (GET /auth/reset-password/confirm),
// which redirects with the token in the query string.
export default function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'done' | 'error'
  >('idle');
  const [error, setError] = useState<unknown>(null);
  const policyMet = isPasswordPolicyConforming(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policyMet) {
      return;
    }
    setStatus('submitting');
    setError(null);

    try {
      await authApi.confirmPasswordReset({ token, password });
      setStatus('done');
    } catch (caught) {
      setError(caught);
      setStatus('error');
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6 text-sm text-red-600">
        {t('reset.missingToken')}
      </main>
    );
  }

  if (status === 'done') {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <p className="text-sm text-green-700">{t('reset.done')}</p>
        <Link to="/login" className="text-sm underline">
          {t('reset.toLogin')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">{t('reset.title')}</h1>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="reset-password" className="text-sm font-medium">
          {t('reset.newPassword')}
        </label>
        <Input
          id="reset-password"
          type="password"
          placeholder={t('reset.newPassword')}
          autoComplete="new-password"
          value={password}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setPassword(event.target.value)
          }
          required
        />
        <PasswordRuleChecklist password={password} />
        <Button type="submit" disabled={status === 'submitting' || !policyMet}>
          {status === 'submitting' ? t('reset.saving') : t('reset.submit')}
        </Button>
      </form>
      {status === 'error' ? (
        <p role="alert" className="text-sm text-red-600">
          {tCommon(resetErrorMessage(error))}
        </p>
      ) : null}
    </main>
  );
}
