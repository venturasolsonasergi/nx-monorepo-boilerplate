import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import type { CreateProfileInput } from '../api/users.schema';

interface UserFormProps {
  onSubmit: (input: CreateProfileInput) => void;
  isSubmitting: boolean;
}

const EMPTY_PROFILE: CreateProfileInput = {
  name: '',
  surname: '',
  address: '',
  phone: '',
};

// Pure presentational form — holds local input state, delegates the actual submit to the caller.
export function UserForm({ onSubmit, isSubmitting }: UserFormProps) {
  const [profile, setProfile] = useState<CreateProfileInput>(EMPTY_PROFILE);

  function handleChange(field: keyof CreateProfileInput) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setProfile((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(profile);
    setProfile(EMPTY_PROFILE);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        placeholder="Nombre"
        value={profile.name}
        onChange={handleChange('name')}
        required
      />
      <Input
        placeholder="Apellidos"
        value={profile.surname}
        onChange={handleChange('surname')}
        required
      />
      <Input
        placeholder="Dirección"
        value={profile.address}
        onChange={handleChange('address')}
        required
      />
      <Input
        type="tel"
        placeholder="Teléfono"
        value={profile.phone}
        onChange={handleChange('phone')}
        required
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Crear perfil'}
      </Button>
    </form>
  );
}
