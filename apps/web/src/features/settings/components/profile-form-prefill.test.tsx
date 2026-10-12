import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileForm } from './profile-form';

afterEach(cleanup);

function renderForm(props: {
  displayName?: string | null;
  initialValues?: {
    name: string;
    surname: string;
    address: string;
    phone: string;
  };
}) {
  const onSubmit = vi.fn();
  const { rerender } = render(
    <ProfileForm onSubmit={onSubmit} isSubmitting={false} {...props} />,
  );
  return { onSubmit, rerender };
}

describe('ProfileForm pre-fill from the provider display name', () => {
  it('splits a multi-token display name into name and surname', () => {
    renderForm({ displayName: 'Joan Pere Sila' });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Joan');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Pere Sila');
    expect(screen.getByLabelText('Dirección')).toHaveValue('');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('');
  });

  it('leaves the surname empty for a single-token display name', () => {
    renderForm({ displayName: 'Madonna' });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Madonna');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('');
  });

  it('never overwrites a field the caller has already typed', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <ProfileForm
        onSubmit={onSubmit}
        isSubmitting={false}
        displayName={null}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Custom' },
    });

    rerender(
      <ProfileForm
        onSubmit={onSubmit}
        isSubmitting={false}
        displayName="Joan Pere Sila"
      />,
    );

    expect(screen.getByLabelText('Nombre')).toHaveValue('Custom');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Pere Sila');
  });

  it('does not pre-fill when a profile already exists', () => {
    renderForm({
      initialValues: {
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      },
      displayName: 'Joan Pere Sila',
    });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Ada');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Lovelace');
    expect(screen.getByLabelText('Dirección')).toHaveValue('1 Main Street');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('555-0100');
  });
});
