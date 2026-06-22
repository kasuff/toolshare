export type AddressSuggestion = {
  label: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

export type AddressValidationResult = {
  isValid: boolean;
  normalizedAddress: string | null;
  normalizedParts: AddressSuggestion | null;
};

export interface GeocodingService {
  suggest(query: string): Promise<AddressSuggestion[]>;
  validate(query: string): Promise<AddressValidationResult>;
}
