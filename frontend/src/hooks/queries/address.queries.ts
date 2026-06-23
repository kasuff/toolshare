import { useQuery } from "@tanstack/react-query";
import { api } from "@toolshare/shared";
import { useEffect, useState } from "react";

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useAddressSuggestions(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query.trim(), 250);
  return useQuery({
    queryKey: ["addresses", "suggest", debounced],
    queryFn: () => api.suggestAddresses(debounced),
    enabled: enabled && debounced.length >= 3,
    staleTime: 30_000
  });
}
