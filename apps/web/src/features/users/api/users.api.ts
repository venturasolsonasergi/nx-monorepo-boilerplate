import { apiClient } from '../../../shared/lib/api-client';
import {
  createUserInputSchema,
  userSchema,
  usersListSchema,
  type CreateUserInput,
} from './users.schema';

const USERS_PATH = '/users';

// The only place in the feature that knows the actual HTTP contract with apps/api.
export const usersApi = {
  list: () => apiClient.get(USERS_PATH, usersListSchema),
  create: (input: CreateUserInput) =>
    apiClient.post(USERS_PATH, userSchema, createUserInputSchema.parse(input)),
};
