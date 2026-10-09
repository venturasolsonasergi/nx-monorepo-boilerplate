import { z } from 'zod';

export const userSettingsSchema = z.object({
  language: z.enum(['es', 'en', 'ca']),
  theme: z.enum(['light', 'dark', 'system']),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

// PATCH updates every field present and leaves the rest untouched; the language
// is always sent because the settings contract requires it.
export const updateUserSettingsSchema = userSettingsSchema.partial({
  theme: true,
});

export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;
