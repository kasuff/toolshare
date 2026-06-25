import { useQuery } from "@tanstack/react-query";
import { api } from "@toolshare/shared";

export const systemKeys = {
  all: ["system"] as const,
  // Systemeinstellungen sind global (nicht nutzerspezifisch). Das Token gehört in
  // den Request-Header, nicht in den Cache-Key – sonst entstünde bei jedem stillen
  // Token-Refresh ein neuer Cache-Eintrag.
  settings: () => [...systemKeys.all, "settings"] as const
};

export function useSystemSettings(token: string) {
  return useQuery({
    queryKey: systemKeys.settings(),
    queryFn: () => api.getSystemSettings(token),
    enabled: Boolean(token)
  });
}
