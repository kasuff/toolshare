import { z } from "zod";

export const addressSuggestionResponseSchema = z.object({
  label: z.string(),
  street: z.string(),
  houseNumber: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string()
});

export const addressSuggestionsResponseSchema = z.object({
  suggestions: z.array(addressSuggestionResponseSchema)
});

export const addressValidationResponseSchema = z.object({
  isValid: z.boolean(),
  normalizedAddress: z.string().nullable(),
  normalizedParts: addressSuggestionResponseSchema.nullable()
});

export type AddressSuggestionResponse = z.infer<typeof addressSuggestionResponseSchema>;
export type AddressValidationResponse = z.infer<typeof addressValidationResponseSchema>;
