import { useQuery } from '@tanstack/react-query';
import { api } from '@toolshare/shared';

// Pendant zu frontend/src/hooks/queries/tools.queries.ts – um die Mobile-Filter
// (Kategorie) erweitert.
export const toolKeys = {
  all: ['tools'] as const,
  lists: () => [...toolKeys.all, 'list'] as const,
  list: (filters: { q?: string; category?: string }) => [...toolKeys.lists(), filters] as const,
  details: () => [...toolKeys.all, 'detail'] as const,
  detail: (id: string) => [...toolKeys.details(), id] as const,
  blocking: (id: string) => [...toolKeys.all, 'blocking', id] as const,
  ratings: (id: string) => [...toolKeys.all, 'ratings', id] as const,
};

export function useTools(filters: { q?: string; category?: string }, token: string | null) {
  return useQuery({
    queryKey: toolKeys.list(filters),
    enabled: Boolean(token),
    queryFn: () => api.getTools(filters, token ?? ''),
  });
}

export function useToolDetail(toolId: string, token: string | null) {
  return useQuery({
    queryKey: toolKeys.detail(toolId),
    enabled: Boolean(toolId && token),
    queryFn: () => api.getToolById(toolId, token ?? ''),
  });
}

export function useToolBlockingPeriods(toolId: string, enabled = true) {
  return useQuery({
    queryKey: toolKeys.blocking(toolId),
    enabled: Boolean(toolId) && enabled,
    queryFn: () => api.getToolBlockingPeriods(toolId),
  });
}

export function useToolRatings(toolId: string) {
  return useQuery({
    queryKey: toolKeys.ratings(toolId),
    enabled: Boolean(toolId),
    queryFn: () => api.getRatingsForTool(toolId),
  });
}
