import { env } from "../../config/env";
import { processOutboxEvent } from "./outbox.processor";
import { outboxRepository } from "./outbox.repository";

let timer: NodeJS.Timeout | null = null;

export async function processOutboxBatch(limit = 10) {
  const events = await outboxRepository.claimPending(limit);
  for (const event of events) {
    try {
      await processOutboxEvent(event);
      await outboxRepository.markProcessed(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outbox error";
      await outboxRepository.markFailed(event.id, message);
    }
  }
  return events.length;
}

export function startOutboxWorker() {
  if (timer) {
    return;
  }
  void processOutboxBatch();
  timer = setInterval(() => {
    void processOutboxBatch();
  }, env.outboxPollIntervalMs);
}

export function stopOutboxWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
