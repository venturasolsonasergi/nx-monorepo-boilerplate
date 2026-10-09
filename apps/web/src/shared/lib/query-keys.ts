// Central query keys shared by features and the layout so cache invalidation
// targets the same entries everywhere.
export const sessionQueryKey = ['auth', 'session'] as const;

export const publicConfigQueryKey = ['auth', 'public-config'] as const;

export const accountQueryKey = ['auth', 'account'] as const;

export const profileQueryPrefix = ['users', 'me'] as const;

export const profileQueryKey = (userId: string) =>
  [...profileQueryPrefix, userId] as const;

export const settingsQueryPrefix = ['users', 'me', 'settings'] as const;

export const settingsQueryKey = (userId: string) =>
  [...settingsQueryPrefix, userId] as const;
