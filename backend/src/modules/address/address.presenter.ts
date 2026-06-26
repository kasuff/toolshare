import type {
  AddressSuggestionResponse,
  AddressValidationResponse
} from "@toolshare/shared/contracts/response/address.schema";
import type { AddressSuggestion, AddressValidationResult } from "../../ports/geocoding.service";

export function toAddressSuggestionResponse(
  suggestion: AddressSuggestion
): AddressSuggestionResponse {
  return {
    label: suggestion.label,
    street: suggestion.street,
    houseNumber: suggestion.houseNumber,
    postalCode: suggestion.postalCode,
    city: suggestion.city,
    country: suggestion.country
  };
}

export function toAddressSuggestionResponseList(
  suggestions: AddressSuggestion[]
): AddressSuggestionResponse[] {
  return suggestions.map(toAddressSuggestionResponse);
}

export function toAddressValidationResponse(
  result: AddressValidationResult
): AddressValidationResponse {
  return {
    isValid: result.isValid,
    normalizedAddress: result.normalizedAddress,
    normalizedParts: result.normalizedParts
      ? toAddressSuggestionResponse(result.normalizedParts)
      : null
  };
}
