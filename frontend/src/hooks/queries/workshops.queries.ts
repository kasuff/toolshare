import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@toolshare/shared";

export const workshopKeys = {
  all: ["workshops"] as const,
  lists: () => [...workshopKeys.all, "list"] as const,
  list: (filters: { q?: string; managerId?: string }) => [...workshopKeys.lists(), filters] as const,
  detail: (id: string) => [...workshopKeys.all, "detail", id] as const,
  ratings: (id: string) => [...workshopKeys.all, "ratings", id] as const,
  myOffers: (userId: string) => [...workshopKeys.all, "my-offers", userId] as const
};

export function useWorkshops(
  filters: { q?: string; managerId?: string },
  token: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: workshopKeys.list(filters),
    queryFn: () => api.getWorkshops(filters, token ?? ""),
    enabled: options?.enabled ?? true
  });
}

export function useMyOffers(userId: string | undefined, token: string | null) {
  return useQuery({
    queryKey: workshopKeys.myOffers(userId ?? ""),
    enabled: Boolean(userId && token),
    queryFn: async () => {
      const [ownedTools, ownedWorkshops, userBookings] = await Promise.all([
        api.getTools({ ownerId: userId! }, token!),
        api.getWorkshops({ managerId: userId! }, token!),
        api.getBookingsForUser(token!)
      ]);
      return {
        tools: ownedTools.filter((tool) => tool.ownerId === userId),
        workshops: ownedWorkshops
          .filter((entry) => entry.workshop.ownerId === userId)
          .map(({ workshop, slots }) => ({ workshop, slots })),
        bookings: userBookings
      };
    }
  });
}

export function useWorkshopRatings(workshopId: string) {
  return useQuery({
    queryKey: workshopKeys.ratings(workshopId),
    queryFn: () => api.getRatingsForWorkshop(workshopId),
    enabled: Boolean(workshopId)
  });
}

export function useCreateWorkshopBooking(token: string) {
  return useMutation({
    mutationFn: (input: { workshopId: string; startIso: string; endIso: string; workshopToolIds?: string[] }) =>
      api.createWorkshopBooking(
        {
          workshopId: input.workshopId,
          startIso: input.startIso,
          endIso: input.endIso,
          workshopToolIds: input.workshopToolIds ?? []
        },
        token
      )
  });
}

export function useCreateWorkshopTimeslot(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workshopId: string;
      startIso: string;
      endIso: string;
      blockedByOwner?: boolean;
    }) => {
      await api.createWorkshopTimeslot(
        input.workshopId,
        {
          startIso: input.startIso,
          endIso: input.endIso,
          blockedByOwner: input.blockedByOwner
        },
        token
      );
      return api.getWorkshopById(input.workshopId, token);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: workshopKeys.detail(variables.workshopId) });
    }
  });
}

export function useDeleteWorkshop(token: string) {
  return useMutation({
    mutationFn: (workshopId: string) => api.deleteWorkshop(workshopId, token)
  });
}
