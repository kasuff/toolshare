type NominatimSearchResult = {
  display_name: string;
};

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_HEADERS = {
  "User-Agent": "toolshare-address-validation/1.0 (se2-project)",
  Accept: "application/json",
  "Accept-Language": "de"
};

async function searchAddress(query: string, limit: number): Promise<NominatimSearchResult[]> {
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

export const addressService = {
  async suggest(query: string) {
    const results = await searchAddress(query, 5);
    return results.map((result) => result.display_name);
  },

  async validate(query: string) {
    const results = await searchAddress(query, 1);
    return {
      isValid: results.length > 0,
      normalizedAddress: results[0]?.display_name ?? null
    };
  }
};
