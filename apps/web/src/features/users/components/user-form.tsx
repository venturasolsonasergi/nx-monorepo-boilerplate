import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import type { CreateUserInput } from '../api/users.schema';

interface UserFormProps {
  onSubmit: (input: CreateUserInput) => void;
  isSubmitting: boolean;
}

// Pure presentational form — holds local input state, delegates the actual submit to the caller.
export function UserForm({ onSubmit, isSubmitting }: UserFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name, email });
    setName('');
    setEmail('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        placeholder="Nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Crear usuario'}
      </Button>
    </form>
  );
}
