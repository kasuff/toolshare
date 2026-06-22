import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@toolshare/shared";

export const workshopKeys = {
  all: ["workshops"] as const,
  detail: (id: string) => [...workshopKeys.all, "detail", id] as const,
  ratings: (id: string) => [...workshopKeys.all, "ratings", id] as const
};

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
