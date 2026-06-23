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

type StructuredAddressSuggestion = {
  label: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
// Harte Obergrenze für den externen Geocoding-Aufruf. Ohne Timeout kann ein
// hängender Nominatim-Request den Handler minutenlang blockieren (real gesehen:
// 458 s) – das staut Requests, treibt den Speicher hoch und hat (ohne Swap)
// die ganze VM eingefroren. Lieber schnell abbrechen und sauber scheitern.
const NOMINATIM_TIMEOUT_MS = 5000;
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
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Address lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as NominatimSearchResult[];
  return Array.isArray(payload) ? payload : [];
}

function parseCoordinate(value?: string): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStructuredSuggestion(result: NominatimSearchResult): StructuredAddressSuggestion {
  const parts = result.address ?? {};
  return {
    label: result.display_name,
    street: parts.road ?? "",
    houseNumber: parts.house_number ?? "",
    postalCode: parts.postcode ?? "",
    city: parts.city ?? parts.town ?? parts.village ?? parts.municipality ?? "",
    country: parts.country ?? "Deutschland",
    latitude: parseCoordinate(result.lat),
    longitude: parseCoordinate(result.lon)
  };
}

export const addressService = {
  async suggest(query: string) {
    const results = await searchAddress(query, 5);
    return results.map(toStructuredSuggestion);
  },

  async validate(query: string) {
    const results = await searchAddress(query, 1);
    const topResult = results[0];
    return {
      isValid: results.length > 0,
      normalizedAddress: topResult?.display_name ?? null,
      normalizedParts: topResult ? toStructuredSuggestion(topResult) : null
    };
  },

  /**
   * Liefert die Koordinaten zur besten Treffer-Adresse oder null, wenn die
   * Adresse nicht geocodiert werden kann bzw. der Dienst nicht erreichbar ist.
   * Wird beim Anlegen/Bearbeiten von Werkzeugen, Werkstätten und Profilen
   * genutzt, damit echte Entfernungen berechnet werden können.
   */
  async geocode(query: string): Promise<GeoCoordinates | null> {
    const normalized = query.trim();
    if (normalized.length < 5) return null;
    try {
      const results = await searchAddress(normalized, 1);
      const top = results[0];
      const latitude = parseCoordinate(top?.lat);
      const longitude = parseCoordinate(top?.lon);
      if (latitude === null || longitude === null) return null;
      return { latitude, longitude };
    } catch {
      // Geocoding darf das Anlegen/Speichern nie blockieren.
      return null;
    }
  }
};
