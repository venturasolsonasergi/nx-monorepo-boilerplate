import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateProfileInput } from '../../users/api/users.schema';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from '../../../shared/i18n/config';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import type { CompleteProfileInput } from '../hooks/use-complete-profile';

interface ProfileFormProps {
  onSubmit: (input: CompleteProfileInput) => void;
  isSubmitting: boolean;
  // Presentational pre-fill and submit wording so creation and update reuse the
  // same form without coupling their targets.
  initialValues?: CreateProfileInput;
  // Display name disclosed by the auth service, used to suggest an empty
  // creation form's name and surname. Ignored when a profile already exists.
  displayName?: string | null;
  submitLabel?: string;
  showLanguage?: boolean;
  onCancel?: () => void;
  // Names of the fields the API rejected; each gets an inline message.
  fieldErrors?: string[];
}

const EMPTY_PROFILE: CreateProfileInput = {
  name: '',
  surname: '',
  address: '',
  phone: '',
};

// First whitespace-separated token fills the name, the remainder fills the
// surname, and a single token leaves the surname empty.
function splitDisplayName(displayName: string): {
  name: string;
  surname: string;
} {
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  const [name = '', ...rest] = tokens;
  return { name, surname: rest.join(' ') };
}

// Collects the business profile fields plus, for creation, the language
// preference, which is pre-selected to the active locale and remains editable
// before submission.
export function ProfileForm({
  onSubmit,
  isSubmitting,
  initialValues,
  displayName,
  submitLabel,
  showLanguage = true,
  onCancel,
  fieldErrors = [],
}: ProfileFormProps) {
  const { t, i18n } = useTranslation('settings');
  const active: Locale = isSupportedLocale(i18n.language)
    ? i18n.language
    : DEFAULT_LOCALE;
  const [profile, setProfile] = useState<CreateProfileInput>(
    initialValues ?? EMPTY_PROFILE,
  );
  const [language, setLanguage] = useState<Locale>(active);

  // Suggest the provider display name only for a missing profile (creation
  // form) and only into still-empty fields, so any value the caller has already
  // typed is preserved. Address and phone are never pre-filled.
  useEffect(() => {
    if (initialValues || displayName === undefined || displayName === null) {
      return;
    }

    const suggestion = splitDisplayName(displayName);
    if (suggestion.name === '' && suggestion.surname === '') {
      return;
    }

    setProfile((current) => ({
      ...current,
      name: current.name.trim() === '' ? suggestion.name : current.name,
      surname:
        current.surname.trim() === '' ? suggestion.surname : current.surname,
    }));
  }, [initialValues, displayName]);

  function hasError(field: keyof CreateProfileInput): boolean {
    return fieldErrors.includes(field);
  }

  function fieldErrorId(field: keyof CreateProfileInput): string {
    return `profile-${field}-error`;
  }

  function handleChange(field: keyof CreateProfileInput) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setProfile((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ ...profile, language });
  }

  function renderField(field: keyof CreateProfileInput) {
    const invalid = hasError(field);
    return (
      <div className="flex flex-col gap-1">
        <Input
          placeholder={t(`fields.${field}`)}
          aria-label={t(`fields.${field}`)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? fieldErrorId(field) : undefined}
          value={profile[field]}
          onChange={handleChange(field)}
          required
        />
        {invalid ? (
          <p id={fieldErrorId(field)} className="text-sm text-destructive">
            {t('fieldInvalid', { field: t(`fields.${field}`) })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {renderField('name')}
      {renderField('surname')}
      {renderField('address')}
      {renderField('phone')}
      {showLanguage ? (
        <>
          <label htmlFor="profile-language" className="text-sm font-medium">
            {t('language')}
          </label>
          <select
            id="profile-language"
            value={language}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setLanguage(event.target.value as Locale)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t(`languages.${locale}`)}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : (submitLabel ?? t('create'))}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
