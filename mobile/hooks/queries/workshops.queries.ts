import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@toolshare/shared';
import { inboxKeys } from './inbox.queries';

// Pendant zu frontend/src/hooks/queries/workshops.queries.ts.
export const workshopKeys = {
  all: ['workshops'] as const,
  lists: () => [...workshopKeys.all, 'list'] as const,
  list: (filters: { q?: string; managerId?: string }) => [...workshopKeys.lists(), filters] as const,
  details: () => [...workshopKeys.all, 'detail'] as const,
  detail: (id: string) => [...workshopKeys.details(), id] as const,
  ratings: (id: string) => [...workshopKeys.all, 'ratings', id] as const,
};

export function useWorkshops(filters: { q?: string; managerId?: string }, token: string | null) {
  return useQuery({
    queryKey: workshopKeys.list(filters),
    enabled: Boolean(token),
    queryFn: () => api.getWorkshops(filters, token ?? ''),
  });
}

export function useWorkshopDetail(workshopId: string, token: string | null) {
  return useQuery({
    queryKey: workshopKeys.detail(workshopId),
    enabled: Boolean(workshopId && token),
    queryFn: () => api.getWorkshopById(workshopId, token ?? ''),
  });
}

export function useWorkshopRatings(workshopId: string) {
  return useQuery({
    queryKey: workshopKeys.ratings(workshopId),
    enabled: Boolean(workshopId),
    queryFn: () => api.getRatingsForWorkshop(workshopId),
  });
}

export function useCreateWorkshopBooking(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workshopId: string;
      startIso: string;
      endIso: string;
      workshopToolIds?: string[];
    }) =>
      api.createWorkshopBooking(
        {
          workshopId: input.workshopId,
          startIso: input.startIso,
          endIso: input.endIso,
          workshopToolIds: input.workshopToolIds ?? [],
        },
        token
      ),
    onSuccess: (_data, variables) => {
      // Buchung belegt einen Zeitraum: Detail (Verfügbarkeit) und die Inbox des
      // Buchenden müssen frisch nachgeladen werden.
      void queryClient.invalidateQueries({ queryKey: workshopKeys.detail(variables.workshopId) });
      void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useCreateWorkshopTimeslot(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workshopId: string;
      startIso: string;
      endIso: string;
      blockedByOwner?: boolean;
    }) =>
      api.createWorkshopTimeslot(
        input.workshopId,
        {
          startIso: input.startIso,
          endIso: input.endIso,
          blockedByOwner: input.blockedByOwner,
        },
        token
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: workshopKeys.detail(variables.workshopId) });
    },
  });
}
