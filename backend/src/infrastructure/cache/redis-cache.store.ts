import { createClient, type RedisClientType } from "redis";
import type { CacheStore } from "../../ports/cache.store";

export class RedisCacheStore implements CacheStore {
  constructor(private readonly client: RedisClientType) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }
}

export async function createRedisClient(redisUrl: string): Promise<RedisClientType> {
  const client = createClient({ url: redisUrl });
  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });
  await client.connect();
  return client as RedisClientType;
}