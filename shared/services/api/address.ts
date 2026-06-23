import type { AddressSuggestion } from "./types";
import { request } from "./client";

export const addressApi = {
  async suggestAddresses(query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < 3) return [];
    try {
      const response = await request<{ suggestions: AddressSuggestion[] }>(
        `/address/suggest?q=${encodeURIComponent(query.trim())}`
      );
      return response.suggestions;
    } catch {
      return [];
    }
  },

  async validateAddress(query: string): Promise<{
    isValid: boolean;
    normalizedAddress: string | null;
    normalizedParts: AddressSuggestion | null;
  }> {
    if (query.trim().length < 5) {
      return { isValid: false, normalizedAddress: null, normalizedParts: null };
    }
    try {
      return await request<{ isValid: boolean; normalizedAddress: string | null; normalizedParts: AddressSuggestion | null }>(
        `/address/validate?q=${encodeURIComponent(query.trim())}`
      );
    } catch {
      // Do not hard-block registration/profile save if provider is unavailable.
      return { isValid: true, normalizedAddress: null, normalizedParts: null };
    }
  },

};
