import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './dialog';

afterEach(() => {
  cleanup();
});

function DialogHarness() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Test dialog</DialogTitle>
        <DialogDescription>Dialog body</DialogDescription>
        <DialogClose>Close</DialogClose>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('renders its content when open', () => {
    render(<DialogHarness />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog body')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<DialogHarness />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on an overlay interaction', async () => {
    render(<DialogHarness />);

    // Radix attaches its outside-pointer listeners in a timeout and dismisses
    // on a pointer down outside the content confirmed by a click.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(document.body, { button: 0 });
    fireEvent.click(document.body);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes through a close control', () => {
    render(<DialogHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
