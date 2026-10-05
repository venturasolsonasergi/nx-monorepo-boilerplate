import { apiClient } from '../../../shared/lib/api-client';
import {
  createProfileInputSchema,
  profileSchema,
  type CreateProfileInput,
} from './users.schema';

const USERS_PATH = '/users';

// The only place in the feature that knows the actual HTTP contract with apps/api.
// GET /users/me returns the caller's profile (200), 404 when none exists, or 401
// without a valid session. POST /users creates the caller's profile from the
// verified session; there is no list endpoint in the users contract.
export const usersApi = {
  getCurrent: () => apiClient.get(`${USERS_PATH}/me`, profileSchema),
  create: (input: CreateProfileInput) =>
    apiClient.post(
      USERS_PATH,
      profileSchema,
      createProfileInputSchema.parse(input),
    ),
};
