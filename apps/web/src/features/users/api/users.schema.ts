import { z } from 'zod';

// Mirrors the users OpenAPI ProfileResponse: the profile is keyed by an
// integer id and linked to the auth-owned authUserId. Identity fields such as
// email are intentionally absent.
export const profileSchema = z.object({
  id: z.number().int().positive(),
  authUserId: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
});

export const createProfileInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  surname: z.string().trim().min(1, 'Los apellidos son obligatorios'),
  address: z.string().trim().min(1, 'La dirección es obligatoria'),
  phone: z.string().trim().min(1, 'El teléfono es obligatorio'),
});

export type Profile = z.infer<typeof profileSchema>;
export type CreateProfileInput = z.infer<typeof createProfileInputSchema>;
