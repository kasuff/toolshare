import { QueryClient } from '@tanstack/react-query';

// Zentraler QueryClient – Pendant zu frontend/src/main.tsx. Defaults bewusst
// konservativ: ein kurzer staleTime verhindert doppeltes Nachladen beim schnellen
// Hin- und Herwechseln zwischen Tabs, retry: 1 hält fehlerhafte Requests kurz.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
