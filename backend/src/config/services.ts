import { env } from "./env";
import { getCacheStore } from "../infrastructure/cache/create-cache-store";
import { CachedGeocodingService } from "../infrastructure/geocoding/cached-geocoding.service";
import { createNominatimRateLimiter } from "../infrastructure/geocoding/nominatim-rate-limiter";
import { NominatimGeocodingAdapter } from "../infrastructure/geocoding/nominatim.adapter";
import { DataUrlImageStorage } from "../infrastructure/storage/data-url-image-storage";
import { S3CompatibleImageStorage } from "../infrastructure/storage/s3-compatible-image-storage";
import type { GeocodingService } from "../ports/geocoding.service";
import type { ImageStorageService } from "../ports/image-storage.service";

let geocodingService: GeocodingService | null = null;
let imageStorageService: ImageStorageService | null = null;

export function getGeocodingService(): GeocodingService {
  if (!geocodingService) {
    geocodingService = createGeocodingService();
  }
  return geocodingService;
}

export function getImageStorageService(): ImageStorageService {
  if (!imageStorageService) {
    imageStorageService = createImageStorageService();
  }
  return imageStorageService;
}

export function createGeocodingService(): GeocodingService {
  const acquireRateLimit = createNominatimRateLimiter(env.nominatimMinIntervalMs);
  const nominatim = new NominatimGeocodingAdapter(acquireRateLimit);
  const cache = getCacheStore({
    cacheBackend: env.cacheBackend as "memory" | "redis",
    redisUrl: env.redisUrl
  });
  return new CachedGeocodingService(nominatim, cache, env.geocodingCacheTtlSeconds);
}

export function createImageStorageService(): ImageStorageService {
  if (
    env.storageBackend === "r2" &&
    env.r2AccountId &&
    env.r2AccessKeyId &&
    env.r2SecretAccessKey &&
    env.r2PublicUrl
  ) {
    return new S3CompatibleImageStorage({
      accountId: env.r2AccountId,
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
      bucket: env.r2Bucket,
      publicUrl: env.r2PublicUrl
    });
  }
  return new DataUrlImageStorage();
}

export function resetServicesForTests(): void {
  geocodingService = null;
  imageStorageService = null;
}