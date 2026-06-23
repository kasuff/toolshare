import { getGeocodingService } from "../../config/services";
import {
  toAddressSuggestionResponseList,
  toAddressValidationResponse
} from "./address.presenter";

export const addressService = {
  async suggest(query: string) {
    const suggestions = await getGeocodingService().suggest(query);
    return toAddressSuggestionResponseList(suggestions);
  },

  async validate(query: string) {
    const result = await getGeocodingService().validate(query);
    return toAddressValidationResponse(result);
  }
};
