import { getGeocodingService } from "../../config/services";

export const addressService = {
  suggest(query: string) {
    return getGeocodingService().suggest(query);
  },

  validate(query: string) {
    return getGeocodingService().validate(query);
  }
};
