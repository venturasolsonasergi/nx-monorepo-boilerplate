import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isPasswordPolicyConforming } from '@app/shared/domain/password-policy';
import {
  ApiError,
  isRateLimitedError,
  rateLimitRetryAfterSeconds,
} from '../../../shared/lib/api-client';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import { PasswordRuleChecklist } from '../../../shared/ui/password-rule-checklist';
import { useChangePassword } from '../../auth';

type FieldError = 'currentPassword' | 'newPassword' | null;

// The 400 shape identifies the offending field: an incorrect current password
// points at the current-password field, unmet policy rules at the new password.
function changePasswordFieldError(error: unknown): FieldError {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return null;
  }

  const details = (error.body as { details?: Array<{ field?: string }> })
    ?.details;
  const field = details?.[0]?.field;
  if (field === 'currentPassword' || field === 'newPassword') {
    return field;
  }

  return null;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [consent, setConsent] = useState(false);

  const policyMet = isPasswordPolicyConforming(newPassword);
  const fieldError = changePasswordFieldError(changePassword.error);
  const rateLimited = isRateLimitedError(changePassword.error);
  const retryAfterSeconds = rateLimitRetryAfterSeconds(changePassword.error);
  const recoverableFailure =
    changePassword.isError && !fieldError && !rateLimited;

  const submitDisabled =
    !currentPassword || !policyMet || !consent || changePassword.isPending;

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setConsent(false);
    changePassword.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !currentPassword ||
      !policyMet ||
      !consent ||
      changePassword.isPending
    ) {
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          onChanged?.();
          handleOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('accountSecurity.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('accountSecurity.dialogDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label
            htmlFor="change-current-password"
            className="text-sm font-medium"
          >
            {t('accountSecurity.currentPassword')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="change-current-password"
              type={showCurrent ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCurrentPassword(event.target.value)
              }
              aria-invalid={fieldError === 'currentPassword' || undefined}
              aria-describedby={
                fieldError === 'currentPassword'
                  ? 'change-current-password-error'
                  : undefined
              }
              required
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={showCurrent}
              onClick={() => setShowCurrent((visible) => !visible)}
            >
              {showCurrent
                ? t('accountSecurity.hide')
                : t('accountSecurity.show')}
            </Button>
          </div>
          {fieldError === 'currentPassword' ? (
            <p
              id="change-current-password-error"
              className="text-sm text-destructive"
            >
              {t('accountSecurity.currentPasswordIncorrect')}
            </p>
          ) : null}

          <label htmlFor="change-new-password" className="text-sm font-medium">
            {t('accountSecurity.newPassword')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="change-new-password"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setNewPassword(event.target.value)
              }
              aria-invalid={fieldError === 'newPassword' || undefined}
              aria-describedby={
                fieldError === 'newPassword'
                  ? 'change-new-password-error'
                  : undefined
              }
              required
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={showNew}
              onClick={() => setShowNew((visible) => !visible)}
            >
              {showNew ? t('accountSecurity.hide') : t('accountSecurity.show')}
            </Button>
          </div>
          {fieldError === 'newPassword' ? (
            <p
              id="change-new-password-error"
              className="text-sm text-destructive"
            >
              {t('accountSecurity.newPasswordRejected')}
            </p>
          ) : null}
          <PasswordRuleChecklist password={newPassword} />

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setConsent(event.target.checked)
              }
              className="mt-0.5"
            />
            <span>{t('accountSecurity.consent')}</span>
          </label>

          <Button type="submit" disabled={submitDisabled}>
            {changePassword.isPending
              ? t('accountSecurity.submitting')
              : t('accountSecurity.submit')}
          </Button>
        </form>
        {rateLimited ? (
          <p role="alert" className="text-sm text-destructive">
            {t('accountSecurity.waitingRetry', {
              seconds: retryAfterSeconds ?? 60,
            })}
          </p>
        ) : null}
        {recoverableFailure ? (
          <p role="alert" className="text-sm text-destructive">
            {changePassword.error instanceof ApiError
              ? t('accountSecurity.changeFailed')
              : tCommon('authErrors.network')}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
