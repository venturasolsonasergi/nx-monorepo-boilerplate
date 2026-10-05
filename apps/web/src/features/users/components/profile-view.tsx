import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card';
import type { Profile } from '../api/users.schema';

const FIELDS: Array<{ label: string; key: keyof Profile }> = [
  { label: 'Nombre', key: 'name' },
  { label: 'Apellidos', key: 'surname' },
  { label: 'Dirección', key: 'address' },
  { label: 'Teléfono', key: 'phone' },
];

export function ProfileView({ profile }: { profile: Profile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi perfil</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="text-sm">{profile[field.key]}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
