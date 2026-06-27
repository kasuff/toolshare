import { Client } from "pg";
import { env } from "../../config/env";
import { triggerDrain } from "./outbox.worker";

let client: Client | null = null;
let stopped = false;

async function connect(): Promise<void> {
  if (stopped) return;

  client = new Client({ connectionString: env.databaseUrl });

  client.on("notification", () => {
    void triggerDrain();
  });

  client.on("error", (err) => {
    // pg emits 'error' before 'end' on unexpected disconnects; log and let 'end' reconnect
    console.error("[outbox-listener] error:", err.message);
  });

  client.on("end", () => {
    client = null;
    if (!stopped) {
      console.warn("[outbox-listener] disconnected — reconnecting in 5s");
      setTimeout(() => void connect(), 5_000);
    }
  });

  await client.connect();
  await client.query("LISTEN outbox_pending");
}

export async function startOutboxListener(): Promise<void> {
  stopped = false;
  await connect();
}

export async function stopOutboxListener(): Promise<void> {
  stopped = true;
  if (client) {
    await client.end();
    client = null;
  }
}