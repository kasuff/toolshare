import type { Response } from "express";
import { createClient, type RedisClientType } from "redis";
import { env } from "../../config/env";

// Echtzeit-Fan-out für die Inbox (Web-SSE). Eine SSE-Verbindung ist an genau die
// Backend-Instanz gebunden, mit der der Client spricht. Bei mehreren Replicas kann
// das auslösende Ereignis auf einer anderen Instanz entstehen → Redis Pub/Sub
// verteilt einen leichten „inbox-changed"-Ping an alle Instanzen, jede pusht an ihre
// lokal verbundenen Clients. Ohne Redis (CACHE_BACKEND=memory, Single-Instance)
// genügt der direkte In-Process-Aufruf (emitLocal).
const CHANNEL = "inbox:events";

const connections = new Map<string, Set<Response>>();

let redisPub: RedisClientType | null = null;

export function registerConnection(userId: string, res: Response): void {
  let set = connections.get(userId);
  if (!set) {
    set = new Set();
    connections.set(userId, set);
  }
  set.add(res);
}

export function unregisterConnection(userId: string, res: Response): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    connections.delete(userId);
  }
}

// Schreibt den Ping an alle lokal verbundenen SSE-Clients dieses Nutzers. Der Client
// lädt daraufhin die Inbox-Queries neu (Payload bewusst leer gehalten).
function emitLocal(userId: string): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  for (const res of set) {
    res.write("event: inbox-changed\ndata: {}\n\n");
  }
}

// Initialisiert den Redis-Pub/Sub-Bus (eigene Subscriber-Connection via duplicate(),
// gleicher Container wie der Geocache). Bei Fehlern/ohne Redis bleibt der reine
// In-Process-Modus aktiv. Aufruf einmalig beim Serverstart.
export async function initInboxEventBus(): Promise<void> {
  if (env.cacheBackend !== "redis" || !env.redisUrl) {
    return;
  }
  try {
    const pub = createClient({ url: env.redisUrl });
    pub.on("error", (error) => console.error("Inbox events redis (pub) error:", error));
    await pub.connect();

    // Subscriber muss eine eigene Connection sein – im subscribe-Modus sind keine
    // normalen Kommandos erlaubt.
    const sub = pub.duplicate();
    sub.on("error", (error) => console.error("Inbox events redis (sub) error:", error));
    await sub.connect();
    await sub.subscribe(CHANNEL, (message) => {
      try {
        const { userId } = JSON.parse(message) as { userId: string };
        if (userId) emitLocal(userId);
      } catch (error) {
        console.error("Invalid inbox event message", error);
      }
    });

    redisPub = pub as RedisClientType;
  } catch (error) {
    console.error("Failed to init inbox event bus – falling back to in-process only", error);
    redisPub = null;
  }
}

// Löst einen Inbox-Aktualisierungs-Ping für den Empfänger aus. Über Redis (alle
// Instanzen) oder – falls nicht verfügbar – direkt in-process.
export function publishInboxChanged(userId: string): void {
  if (redisPub) {
    redisPub.publish(CHANNEL, JSON.stringify({ userId })).catch((error) => {
      console.error("Failed to publish inbox event", error);
      emitLocal(userId);
    });
    return;
  }
  emitLocal(userId);
}
