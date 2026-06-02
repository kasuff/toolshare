import { describe, expect, it } from "vitest";
import {
  coordinatesForLocation,
  distanceBetweenLocations,
  distanceInKm,
  formatDistance,
  hasMatchingSlot,
  isWithinRadius
} from "../../src/utils/searchFilters";
import type { WorkshopSlot } from "../../src/types/domain";

const baseSlot = {
  id: "slot-1",
  workshopId: "workshop-1"
};

describe("searchFilters", () => {
  it("resolves known and fallback locations deterministically", () => {
    expect(coordinatesForLocation("Leopoldstraße 120, München")).toEqual({ lat: 48.1668, lon: 11.5868 });
    expect(coordinatesForLocation("")).toBeNull();

    const first = coordinatesForLocation("Fantasiestraße 42");
    const second = coordinatesForLocation("Fantasiestraße 42");

    expect(first).toEqual(second);
    expect(first?.lat).toBeGreaterThan(48.12);
    expect(first?.lon).toBeGreaterThan(11.56);
  });

  it("calculates and formats distances for radius filtering", () => {
    const center = { lat: 48.1372, lon: 11.5755 };
    const nearby = { lat: 48.1382, lon: 11.5755 };

    expect(distanceInKm(center, nearby)).toBeGreaterThan(0);
    expect(formatDistance(null)).toBe("Distanz offen");
    expect(formatDistance(0.42)).toBe("420 m");
    expect(formatDistance(1.25)).toBe("1,3 km");
    expect(distanceBetweenLocations("München Zentrum", "Leopoldstraße 120, München")).toBeGreaterThan(0);
    expect(distanceBetweenLocations("", "Leopoldstraße 120, München")).toBeNull();
    expect(isWithinRadius("München Zentrum", "Leopoldstraße 120, München", 5)).toBe(true);
    expect(isWithinRadius("München Zentrum", "Heidemannstraße 20, München", 1)).toBe(false);
    expect(isWithinRadius("München Zentrum", "", 5)).toBe(true);
    expect(isWithinRadius("München Zentrum", undefined, 5)).toBe(true);
  });

  it("matches only unblocked workshop slots against date ranges", () => {
    const slots: WorkshopSlot[] = [
      {
        ...baseSlot,
        id: "blocked",
        startIso: "2026-06-01T10:00",
        endIso: "2026-06-01T12:00",
        blockedByOwner: true
      },
      {
        ...baseSlot,
        id: "available",
        startIso: "2026-06-03T10:00",
        endIso: "2026-06-03T12:00",
        blockedByOwner: false
      }
    ];

    expect(hasMatchingSlot(slots)).toBe(true);
    expect(hasMatchingSlot(slots, "2026-06-03", "2026-06-03")).toBe(true);
    expect(hasMatchingSlot(slots, "2026-06-04", "2026-06-05")).toBe(false);
    expect(hasMatchingSlot([{ ...slots[0] }], "2026-06-01", "2026-06-01")).toBe(false);
  });
});
