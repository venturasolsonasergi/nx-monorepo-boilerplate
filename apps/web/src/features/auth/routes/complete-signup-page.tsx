import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { errorBodyField } from '../../../shared/lib/api-client';
import { completeSignupErrorMessage } from '../lib/auth-messages';
import { useCompleteSignup } from '../hooks/use-complete-signup';

const MIN_PASSWORD_LENGTH = 8;

export default function CompleteSignupPage() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const complete = useCompleteSignup();

  if (!token) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">
          {t('completeSignup.invalidLinkTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('completeSignup.missingToken')}
        </p>
        <Link to="/signup" className="text-sm underline">
          {t('completeSignup.restartShort')}
        </Link>
      </main>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    complete.mutate({ token, password });
  }

  const activationCommitted =
    complete.isError &&
    errorBodyField<boolean>(complete.error, 'accountActivated') === true;

  if (activationCommitted) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">
          {t('completeSignup.activatedTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('completeSignup.activatedMessage')}
        </p>
        <Link to="/login" className="text-sm underline">
          {t('completeSignup.toLogin')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">
        {t('completeSignup.choosePassword')}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="complete-password" className="text-sm font-medium">
          {t('completeSignup.password')}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="complete-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setPassword(event.target.value)
            }
            required
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? t('completeSignup.hide') : t('completeSignup.show')}
          </Button>
        </div>
        <Button type="submit" disabled={complete.isPending}>
          {complete.isPending
            ? t('completeSignup.activating')
            : t('completeSignup.submit')}
        </Button>
      </form>
      {complete.isError && !activationCommitted ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">
            {tCommon(completeSignupErrorMessage(complete.error))}
          </p>
          <Link to="/signup" className="text-sm underline">
            {t('completeSignup.restart')}
          </Link>
        </div>
      ) : null}
    </main>
  );
}
