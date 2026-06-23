import type {
  AddressSuggestion,
  AddressValidationResult,
  GeocodingService
} from "../../ports/geocoding.service";

type NominatimAddressParts = {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  country?: string;
};

type NominatimSearchResult = {
  display_name: string;
  address?: NominatimAddressParts;
};

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_HEADERS = {
  "User-Agent": "toolshare-address-validation/1.0 (se2-project)",
  Accept: "application/json",
  "Accept-Language": "de"
};

function toStructuredSuggestion(result: NominatimSearchResult): AddressSuggestion {
  const parts = result.address ?? {};
  return {
    label: result.display_name,
    street: parts.road ?? "",
    houseNumber: parts.house_number ?? "",
    postalCode: parts.postcode ?? "",
    city: parts.city ?? parts.town ?? parts.village ?? parts.municipality ?? "",
    country: parts.country ?? "Deutschland"
  };
}

export class NominatimGeocodingAdapter implements GeocodingService {
  constructor(private readonly acquireRateLimit: () => Promise<void>) {}

  async suggest(query: string): Promise<AddressSuggestion[]> {
    const results = await this.searchAddress(query, 5);
    return results.map(toStructuredSuggestion);
  }

  async validate(query: string): Promise<AddressValidationResult> {
    const results = await this.searchAddress(query, 1);
    const topResult = results[0];
    return {
      isValid: results.length > 0,
      normalizedAddress: topResult?.display_name ?? null,
      normalizedParts: topResult ? toStructuredSuggestion(topResult) : null
    };
  }

  private async searchAddress(query: string, limit: number): Promise<NominatimSearchResult[]> {
    await this.acquireRateLimit();

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: String(limit),
      countrycodes: "de"
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
      method: "GET",
      headers: REQUEST_HEADERS
    });

    if (!response.ok) {
      throw new Error(`Address lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as NominatimSearchResult[];
    return Array.isArray(payload) ? payload : [];
  }
}
