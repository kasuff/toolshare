import type { CacheStore } from "../../ports/cache.store";
import { InMemoryCacheStore } from "./in-memory-cache.store";
import { createRedisClient, RedisCacheStore } from "./redis-cache.store";

type CacheEnv = {
  cacheBackend: "memory" | "redis";
  redisUrl?: string;
};

let cacheStore: CacheStore | null = null;
let redisInitPromise: Promise<CacheStore> | null = null;

async function initCacheStore(env: CacheEnv): Promise<CacheStore> {
  if (env.cacheBackend === "redis" && env.redisUrl) {
    const client = await createRedisClient(env.redisUrl);
    return new RedisCacheStore(client);
  }
  return new InMemoryCacheStore();
}

export function getCacheStore(env: CacheEnv): CacheStore {
  if (cacheStore) {
    return cacheStore;
  }

  if (env.cacheBackend === "redis" && env.redisUrl) {
    if (!redisInitPromise) {
      redisInitPromise = initCacheStore(env).then((store) => {
        cacheStore = store;
        return store;
      });
    }
    return new DeferredCacheStore(redisInitPromise);
  }

  cacheStore = new InMemoryCacheStore();
  return cacheStore;
}

class DeferredCacheStore implements CacheStore {
  constructor(private readonly ready: Promise<CacheStore>) {}

  async get<T>(key: string): Promise<T | null> {
    const store = await this.ready;
    return store.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const store = await this.ready;
    await store.set(key, value, ttlSeconds);
  }
}

export function resetCacheStoreForTests(): void {
  cacheStore = null;
  redisInitPromise = null;
}