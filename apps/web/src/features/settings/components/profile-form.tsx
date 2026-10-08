import { useState, type ChangeEvent, type FormEvent } from 'react';
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
}

const EMPTY_PROFILE: CreateProfileInput = {
  name: '',
  surname: '',
  address: '',
  phone: '',
};

// Collects the business profile fields plus the language preference, which is
// pre-selected to the active locale and remains editable before submission.
export function ProfileForm({ onSubmit, isSubmitting }: ProfileFormProps) {
  const { t, i18n } = useTranslation('settings');
  const active: Locale = isSupportedLocale(i18n.language)
    ? i18n.language
    : DEFAULT_LOCALE;
  const [profile, setProfile] = useState<CreateProfileInput>(EMPTY_PROFILE);
  const [language, setLanguage] = useState<Locale>(active);

  function handleChange(field: keyof CreateProfileInput) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setProfile((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ ...profile, language });
    setProfile(EMPTY_PROFILE);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        placeholder={t('fields.name')}
        value={profile.name}
        onChange={handleChange('name')}
        required
      />
      <Input
        placeholder={t('fields.surname')}
        value={profile.surname}
        onChange={handleChange('surname')}
        required
      />
      <Input
        placeholder={t('fields.address')}
        value={profile.address}
        onChange={handleChange('address')}
        required
      />
      <Input
        type="tel"
        placeholder={t('fields.phone')}
        value={profile.phone}
        onChange={handleChange('phone')}
        required
      />
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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('saving') : t('create')}
      </Button>
    </form>
  );
}
