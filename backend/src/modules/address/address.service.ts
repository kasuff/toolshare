import { getGeocodingService } from "../../config/services";
import {
  toAddressSuggestionResponseList,
  toAddressValidationResponse
} from "./address.presenter";

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

export const addressService = {
  async suggest(query: string) {
    const suggestions = await getGeocodingService().suggest(query);
    return toAddressSuggestionResponseList(suggestions);
  },

  async validate(query: string) {
    const result = await getGeocodingService().validate(query);
    return toAddressValidationResponse(result);
  },

  async geocode(query: string): Promise<GeoCoordinates | null> {
    const normalized = query.trim();
    if (normalized.length < 5) return null;
    try {
      const result = await getGeocodingService().geocode(normalized);
      return result;
    } catch {
      return null;
    }
  }
};
