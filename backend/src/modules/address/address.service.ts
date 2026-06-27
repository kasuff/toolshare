import { getGeocodingService } from "../../config/services";

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

export const addressService = {
  async suggest(query: string) {
    return await getGeocodingService().suggest(query);
  },

  async validate(query: string) {
    return await getGeocodingService().validate(query);
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
