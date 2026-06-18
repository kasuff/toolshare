export type AddressFormFields = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

export const EMPTY_ADDRESS: AddressFormFields = {
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  country: "Deutschland"
};

export function toAddressPayload(fields: AddressFormFields) {
  return `${fields.street} ${fields.houseNumber}, ${fields.postalCode} ${fields.city}, ${fields.country}`
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseAddress(raw?: string): AddressFormFields {
  if (!raw) return { ...EMPTY_ADDRESS };

  const [streetPart = "", cityPart = "", countryPart = "Deutschland"] = raw.split(",").map((part) => part.trim());
  const streetTokens = streetPart.split(/\s+/).filter(Boolean);
  const houseNumber = streetTokens.length > 1 ? streetTokens.pop() ?? "" : "";
  const cityTokens = cityPart.split(/\s+/).filter(Boolean);
  const postalCode = cityTokens.length > 1 ? cityTokens.shift() ?? "" : "";

  return {
    street: streetTokens.join(" "),
    houseNumber,
    postalCode,
    city: cityTokens.join(" "),
    country: countryPart || "Deutschland"
  };
}

export function isAddressComplete(fields: AddressFormFields) {
  return Boolean(
    fields.street.trim() &&
      fields.houseNumber.trim() &&
      fields.postalCode.trim() &&
      fields.city.trim()
  );
}
