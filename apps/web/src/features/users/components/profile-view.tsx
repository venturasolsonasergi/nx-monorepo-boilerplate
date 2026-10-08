import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card';
import type { Profile } from '../api/users.schema';

const FIELDS: Array<{ labelKey: string; key: keyof Profile }> = [
  { labelKey: 'fields.name', key: 'name' },
  { labelKey: 'fields.surname', key: 'surname' },
  { labelKey: 'fields.address', key: 'address' },
  { labelKey: 'fields.phone', key: 'phone' },
];

export function ProfileView({ profile }: { profile: Profile }) {
  const { t } = useTranslation('settings');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <dt className="text-xs text-muted-foreground">
                {t(field.labelKey)}
              </dt>
              <dd className="text-sm">{profile[field.key]}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
