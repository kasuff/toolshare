import type { WorkshopSlot } from "../types/domain";

export type AvailabilityFilter = "all" | "available";

export type Coordinates = {
  lat: number;
  lon: number;
};

const KNOWN_LOCATIONS: Array<{ pattern: RegExp; coordinates: Coordinates }> = [
  { pattern: /heidemann|neufreimann/i, coordinates: { lat: 48.2058, lon: 11.5936 } },
  { pattern: /leopold|schwabing|80802/i, coordinates: { lat: 48.1668, lon: 11.5868 } },
  { pattern: /sendling/i, coordinates: { lat: 48.1114, lon: 11.5369 } },
  { pattern: /giesing/i, coordinates: { lat: 48.1118, lon: 11.5887 } },
  { pattern: /maxvorstadt/i, coordinates: { lat: 48.1503, lon: 11.5686 } },
  { pattern: /münchen|muenchen|munich|zentrum|marienplatz/i, coordinates: { lat: 48.1372, lon: 11.5755 } }
];

function fallbackCoordinatesFor(value: string): Coordinates {
  let hash = 0;
  for (const char of value.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  }

  const latOffset = ((hash % 2400) - 1200) / 100000;
  const lonOffset = (((Math.floor(hash / 17) % 2400) - 1200) / 100000);
  return { lat: 48.1372 + latOffset, lon: 11.5755 + lonOffset };
}

export function coordinatesForLocation(value?: string): Coordinates | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return KNOWN_LOCATIONS.find((entry) => entry.pattern.test(normalized))?.coordinates ?? fallbackCoordinatesFor(normalized);
}

export function distanceInKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(distance: number | null): string {
  if (distance === null) return "Distanz offen";
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(1).replace(".", ",")} km`;
}

export function distanceBetweenLocations(origin: string, target?: string): number | null {
  const originCoordinates = coordinatesForLocation(origin);
  const targetCoordinates = coordinatesForLocation(target);
  if (!originCoordinates || !targetCoordinates) return null;
  return distanceInKm(originCoordinates, targetCoordinates);
}

export function isWithinRadius(origin: string, target: string | undefined, radiusKm: number): boolean {
  const distance = distanceBetweenLocations(origin, target);
  return distance !== null && distance <= radiusKm;
}

function startsBeforeOrAt(slotStart: string, filterEnd?: string) {
  if (!filterEnd) return true;
  return new Date(slotStart).getTime() <= new Date(`${filterEnd}T23:59`).getTime();
}

function endsAfterOrAt(slotEnd: string, filterStart?: string) {
  if (!filterStart) return true;
  return new Date(slotEnd).getTime() >= new Date(`${filterStart}T00:00`).getTime();
}

export function hasMatchingSlot(slots: WorkshopSlot[], filterStart?: string, filterEnd?: string): boolean {
  if (!filterStart && !filterEnd) return true;
  return slots.some((slot) => !slot.blockedByOwner && startsBeforeOrAt(slot.startIso, filterEnd) && endsAfterOrAt(slot.endIso, filterStart));
}
