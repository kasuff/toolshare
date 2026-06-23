import type {  WorkshopSlot  } from "../types/domain";

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
  const normalized = target?.trim();
  if (!normalized) return false;
  const distance = distanceBetweenLocations(origin, target);
  if (distance === null) return false;
  return distance <= radiusKm;
}

/**
 * Ein Ort mit optionalen, vorab geocodierten Koordinaten und einer Adresse
 * als Fallback. Wenn echte Koordinaten vorliegen, werden diese verwendet –
 * sonst wird die Adresse grob über bekannte Muster aufgelöst.
 */
export type GeoPoint = {
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
};

export function coordinatesForPoint(point: GeoPoint): Coordinates | null {
  if (typeof point.latitude === "number" && typeof point.longitude === "number") {
    return { lat: point.latitude, lon: point.longitude };
  }
  return coordinatesForLocation(point.location ?? undefined);
}

export function distanceBetweenPoints(origin: GeoPoint, target: GeoPoint): number | null {
  const originCoordinates = coordinatesForPoint(origin);
  const targetCoordinates = coordinatesForPoint(target);
  if (!originCoordinates || !targetCoordinates) return null;
  return distanceInKm(originCoordinates, targetCoordinates);
}

export function isPointWithinRadius(origin: GeoPoint, target: GeoPoint, radiusKm: number): boolean {
  const distance = distanceBetweenPoints(origin, target);
  if (distance === null) return false;
  return distance <= radiusKm;
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

export function rangeOverlapsDay(startIso: string, endIso: string, day: Date) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0);
  return new Date(startIso) < dayEnd && new Date(endIso) > dayStart;
}

export function isDayUnavailable(day: Date, slots: any[], bookedRanges: any[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (day < todayStart) {
    return true;
  }
  const blocked = slots.some((slot) => slot.blockedByOwner && rangeOverlapsDay(slot.startIso, slot.endIso, day));
  const booked = bookedRanges.some((range) => rangeOverlapsDay(range.startIso, range.endIso, day));
  return blocked || booked;
}

export function isDateRangeAvailable(
  startDate: string,
  endDate: string,
  slots: any[],
  bookedRanges: any[]
) {
  if (!startDate || !endDate) return false;
  if (startDate > endDate) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isDayUnavailable(d, slots, bookedRanges)) {
      return false;
    }
  }
  return true;
}
