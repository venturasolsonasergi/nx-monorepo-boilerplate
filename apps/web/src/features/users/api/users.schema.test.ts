import { describe, expect, it } from 'vitest';
import { createProfileInputSchema } from './users.schema';

describe('createProfileInputSchema', () => {
  it('accepts and trims valid profile input', () => {
    expect(
      createProfileInputSchema.parse({
        name: '  Ana ',
        surname: ' García ',
        address: ' Calle 1 ',
        phone: ' 600000000 ',
      }),
    ).toEqual({
      name: 'Ana',
      surname: 'García',
      address: 'Calle 1',
      phone: '600000000',
    });
  });

  it('rejects a required field that is empty after trimming', () => {
    expect(() =>
      createProfileInputSchema.parse({
        name: '   ',
        surname: 'García',
        address: 'Calle 1',
        phone: '600000000',
      }),
    ).toThrow();
  });
});
