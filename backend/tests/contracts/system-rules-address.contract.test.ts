import { describe, expect, it } from "vitest";
import {
  systemSettingResponseSchema
} from "@toolshare/shared/contracts/response/system-rules.schema";
import {
  addressSuggestionsResponseSchema,
  addressValidationResponseSchema
} from "@toolshare/shared/contracts/response/address.schema";
import { toSystemSettingResponse } from "../../src/modules/system-rules/controllers/system-rules.presenter";
import {
  toAddressSuggestionResponseList,
  toAddressValidationResponse
} from "../../src/modules/address/controllers/address.presenter";

describe("system-rules + address contracts", () => {
  it("system setting presenter matches schema and hides internal fields", () => {
    const response = toSystemSettingResponse({
      key: "maxLoanDurationDays",
      label: "Maximale Ausleihdauer eines Werkzeugs",
      unit: "Tage",
      defaultValue: 14,
      min: 1,
      max: 365,
      enforced: true,
      value: 21
    });
    expect(() => systemSettingResponseSchema.parse(response)).not.toThrow();
    expect(response).not.toHaveProperty("defaultValue");
    expect(response).not.toHaveProperty("enforced");
    expect(response.value).toBe(21);
  });

  it("address suggestions presenter matches schema", () => {
    const suggestions = toAddressSuggestionResponseList([
      {
        label: "Hauptstr. 1, 80331 München",
        street: "Hauptstr.",
        houseNumber: "1",
        postalCode: "80331",
        city: "München",
        country: "Deutschland"
      }
    ]);
    expect(() => addressSuggestionsResponseSchema.parse({ suggestions })).not.toThrow();
  });

  it("address validation presenter matches schema", () => {
    const response = toAddressValidationResponse({
      isValid: true,
      normalizedAddress: "Hauptstr. 1, 80331 München",
      normalizedParts: {
        label: "Hauptstr. 1, 80331 München",
        street: "Hauptstr.",
        houseNumber: "1",
        postalCode: "80331",
        city: "München",
        country: "Deutschland"
      }
    });
    expect(() => addressValidationResponseSchema.parse(response)).not.toThrow();
  });
});