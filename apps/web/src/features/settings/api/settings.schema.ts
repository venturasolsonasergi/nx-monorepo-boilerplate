import { z } from 'zod';

export const userSettingsSchema = z.object({
  language: z.enum(['es', 'en', 'ca']),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
