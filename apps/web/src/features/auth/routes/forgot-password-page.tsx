import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { recoverErrorMessage } from '../lib/auth-messages';
import { useRequestPasswordReset } from '../hooks/use-request-password-reset';

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const [email, setEmail] = useState('');
  const request = useRequestPasswordReset();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate(email);
  }

  if (request.isSuccess) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">{t('forgot.sentTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('forgot.sentMessage')}
        </p>
        <Link to="/login" className="text-sm underline">
          {t('forgot.toLogin')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">{t('forgot.title')}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          {t('forgot.email')}
        </label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setEmail(event.target.value)
          }
          required
        />
        <Button type="submit" disabled={request.isPending}>
          {request.isPending ? t('forgot.sending') : t('forgot.submit')}
        </Button>
      </form>
      {request.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {tCommon(recoverErrorMessage(request.error))}
        </p>
      ) : null}
      <Link to="/login" className="text-sm underline">
        {t('forgot.toLogin')}
      </Link>
    </main>
  );
}
