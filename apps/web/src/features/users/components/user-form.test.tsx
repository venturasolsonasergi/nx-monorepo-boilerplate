import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserForm } from './user-form';

afterEach(cleanup);

const FIELDS = ['Nombre', 'Apellidos', 'Dirección', 'Teléfono'] as const;

describe('UserForm', () => {
  it('renders the four required profile fields', () => {
    render(<UserForm onSubmit={vi.fn()} isSubmitting={false} />);
    for (const field of FIELDS) {
      expect(screen.getByPlaceholderText(field)).toBeRequired();
    }
  });

  it('submits the entered profile values', () => {
    const onSubmit = vi.fn();
    render(<UserForm onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByPlaceholderText('Nombre'), {
      target: { value: 'Ana' },
    });
    fireEvent.change(screen.getByPlaceholderText('Apellidos'), {
      target: { value: 'García' },
    });
    fireEvent.change(screen.getByPlaceholderText('Dirección'), {
      target: { value: 'Calle 1' },
    });
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '600000000' },
    });

    const form = screen
      .getByRole('button', { name: 'Crear perfil' })
      .closest('form');
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Ana',
      surname: 'García',
      address: 'Calle 1',
      phone: '600000000',
    });
  });

  it('disables the submit control while submitting', () => {
    render(<UserForm onSubmit={vi.fn()} isSubmitting />);
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });
});
