import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';

export const usersQueryKeys = {
  all: ['users'] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKeys.all,
    queryFn: usersApi.list,
  });
}
