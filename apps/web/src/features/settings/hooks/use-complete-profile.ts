import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../shared/lib/api-client';
import { profileQueryKey } from '../../../shared/lib/query-keys';
import type { Locale } from '../../../shared/i18n/config';
import { usersApi } from '../../users/api/users.api';
import type { CreateProfileInput, Profile } from '../../users/api/users.schema';
import { settingsApi } from '../api/settings.api';

export interface CompleteProfileInput extends CreateProfileInput {
  language: Locale;
}

// Completing the profile submits two requests in order: the language preference
// first (idempotent), then the profile. A 409 on the profile means it already
// exists, so the flow continues with the existing profile instead of failing.
export function useCompleteProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteProfileInput): Promise<Profile> => {
      await settingsApi.update({ language: input.language });

      try {
        return await usersApi.create({
          name: input.name,
          surname: input.surname,
          address: input.address,
          phone: input.phone,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return usersApi.getCurrent();
        }
        throw error;
      }
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(userId), profile);
    },
  });
}
