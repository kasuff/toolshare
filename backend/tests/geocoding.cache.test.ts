import { describe, expect, it, vi } from "vitest";
import { InMemoryCacheStore } from "../src/infrastructure/cache/in-memory-cache.store";
import { CachedGeocodingService } from "../src/infrastructure/geocoding/cached-geocoding.service";
import type { GeocodingService } from "../src/ports/geocoding.service";

describe("CachedGeocodingService", () => {
  it("returns cached suggest results without calling inner service twice", async () => {
    const inner: GeocodingService = {
      suggest: vi.fn(async () => [
        {
          label: "Test",
          street: "Test",
          houseNumber: "1",
          postalCode: "80331",
          city: "Muenchen",
          country: "Deutschland"
        }
      ]),
      validate: vi.fn()
    };
    const cache = new InMemoryCacheStore();
    const service = new CachedGeocodingService(inner, cache, 60);

    const first = await service.suggest("Musterstrasse 1");
    const second = await service.suggest("Musterstrasse 1");

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(inner.suggest).toHaveBeenCalledTimes(1);
  });
});