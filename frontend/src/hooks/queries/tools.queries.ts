import { useQuery } from "@tanstack/react-query";
import { api } from "@toolshare/shared";

export const toolKeys = {
  all: ["tools"] as const,
  lists: () => [...toolKeys.all, "list"] as const,
  list: (filters: { q?: string }) => [...toolKeys.lists(), filters] as const
};

export function useTools(filters: { q?: string }, token: string | null) {
  return useQuery({
    queryKey: toolKeys.list(filters),
    queryFn: () => api.getTools(filters, token ?? "")
  });
}
