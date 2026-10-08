import { apiClient } from '../../../shared/lib/api-client';
import { userSettingsSchema, type UserSettings } from './settings.schema';

const SETTINGS_PATH = '/users/me/settings';

// The only place in the feature that knows the settings HTTP contract.
// GET returns the caller's settings (200) or 404 when none exist; PATCH upserts
// the provided fields for the caller's session-derived identity.
export const settingsApi = {
  get: () => apiClient.get(SETTINGS_PATH, userSettingsSchema),
  update: (input: UserSettings) =>
    apiClient.patch(SETTINGS_PATH, userSettingsSchema, input),
};
