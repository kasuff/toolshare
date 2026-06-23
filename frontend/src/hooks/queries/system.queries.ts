import { useQuery } from "@tanstack/react-query";
import { api } from "@toolshare/shared";

export const systemKeys = {
  all: ["system"] as const,
  settings: (token: string) => [...systemKeys.all, "settings", token] as const
};

export function useSystemSettings(token: string) {
  return useQuery({
    queryKey: systemKeys.settings(token),
    queryFn: () => api.getSystemSettings(token),
    enabled: Boolean(token)
  });
}
