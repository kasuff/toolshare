import { useQuery } from '@tanstack/react-query';
import { api } from '@toolshare/shared';
import type { Tool, Workshop } from '@toolshare/shared';

// Pendant zu useMyOffers in frontend/src/hooks/queries/workshops.queries.ts –
// die Mobile-„Meine Angebote“-Seite zeigt nur eigene Werkzeuge und Werkstätten
// (keine Buchungsübersicht), daher die schlankere Variante.
export const offerKeys = {
  all: ['offers'] as const,
  mine: (userId: string) => [...offerKeys.all, userId] as const,
};

export function useMyOffers(userId: string | undefined, token: string | null) {
  return useQuery({
    queryKey: offerKeys.mine(userId ?? ''),
    enabled: Boolean(userId && token),
    queryFn: async (): Promise<{ tools: Tool[]; workshops: Workshop[] }> => {
      const [ownedTools, ownedWorkshops] = await Promise.all([
        api.getTools({ ownerId: userId! }, token!),
        api.getWorkshops({ managerId: userId! }, token!),
      ]);
      return {
        tools: ownedTools.filter((tool) => tool.ownerId === userId),
        workshops: ownedWorkshops
          .filter((entry) => entry.workshop.ownerId === userId)
          .map((entry) => entry.workshop),
      };
    },
  });
}
