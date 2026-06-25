import type { CacheStore } from "../../ports/cache.store";
import type { GeocodingService } from "../../ports/geocoding.service";

function cacheKey(prefix: "suggest" | "validate" | "geocode", query: string): string {
  return `geocoding:${prefix}:${query.toLowerCase().trim()}`;
}

export class CachedGeocodingService implements GeocodingService {
  constructor(
    private readonly inner: GeocodingService,
    private readonly cache: CacheStore,
    private readonly ttlSeconds: number
  ) {}

  async suggest(query: string) {
    const key = cacheKey("suggest", query);
    const cached = await this.cache.get<Awaited<ReturnType<GeocodingService["suggest"]>>>(key);
    if (cached) {
      return cached;
    }
    const result = await this.inner.suggest(query);
    await this.cache.set(key, result, this.ttlSeconds);
    return result;
  }

  async validate(query: string) {
    const key = cacheKey("validate", query);
    const cached = await this.cache.get<Awaited<ReturnType<GeocodingService["validate"]>>>(key);
    if (cached) {
      return cached;
    }
    const result = await this.inner.validate(query);
    await this.cache.set(key, result, this.ttlSeconds);
    return result;
  }

  async geocode(query: string) {
    const key = cacheKey("geocode", query);
    const cached = await this.cache.get<NonNullable<Awaited<ReturnType<GeocodingService["geocode"]>>>>(key);
    if (cached !== null) {
      return cached;
    }
    const result = await this.inner.geocode(query);
    if (result !== null) {
      await this.cache.set(key, result, this.ttlSeconds);
    }
    return result;
  }
}
