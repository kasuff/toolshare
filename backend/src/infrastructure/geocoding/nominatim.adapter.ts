import type {
  AddressSuggestion,
  AddressValidationResult,
  GeoCoordinates,
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
  lat?: string;
  lon?: string;
  address?: NominatimAddressParts;
};

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
// Hard limit for external geocoding calls. Without a timeout a hanging
// Nominatim request can block the handler for minutes, stacking up requests
// and exhausting memory on VMs without swap.
const NOMINATIM_TIMEOUT_MS = 5000;
const REQUEST_HEADERS = {
  "User-Agent": "toolshare-address-validation/1.0 (se2-project)",
  Accept: "application/json",
  "Accept-Language": "de"
};

function parseCoordinate(value?: string): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  async geocode(query: string): Promise<GeoCoordinates | null> {
    try {
      const results = await this.searchAddress(query, 1);
      const top = results[0];
      const latitude = parseCoordinate(top?.lat);
      const longitude = parseCoordinate(top?.lon);
      if (latitude === null || longitude === null) return null;
      return { latitude, longitude };
    } catch {
      return null;
    }
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
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Address lookup failed with status ${response.status}`);
    }

    const payload = (await response.json()) as NominatimSearchResult[];
    return Array.isArray(payload) ? payload : [];
  }
}
