import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string(),
});

export const usersListSchema = z.array(userSchema);

export const createUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, 'El nombre es obligatorio'),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
