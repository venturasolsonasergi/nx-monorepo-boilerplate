import { QueryClient } from '@tanstack/react-query';

// Central cache shared by every feature's hooks — features never instantiate their own client.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
