import { requestParsed } from "./client";
import {
  addressSuggestionsResponseSchema,
  addressValidationResponseSchema
} from "../../contracts/response/address.schema";

export const addressApi = {
  async suggestAddresses(query: string) {
    if (query.trim().length < 3) return [];
    try {
      const response = await requestParsed(
        addressSuggestionsResponseSchema,
        `/address/suggest?q=${encodeURIComponent(query.trim())}`
      );
      return response.suggestions;
    } catch {
      return [];
    }
  },

  async validateAddress(query: string) {
    if (query.trim().length < 5) {
      return { isValid: false, normalizedAddress: null, normalizedParts: null };
    }
    try {
      return await requestParsed(
        addressValidationResponseSchema,
        `/address/validate?q=${encodeURIComponent(query.trim())}`
      );
    } catch {
      return { isValid: true, normalizedAddress: null, normalizedParts: null };
    }
  }
};
