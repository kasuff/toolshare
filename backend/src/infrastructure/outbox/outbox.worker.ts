import { processOutboxEvent } from "./outbox.processor";
import { outboxRepository } from "./outbox.repository";

let draining = false;
let pendingDrain = false;
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

// Drains the queue until empty. Re-checks once if a notification arrived during
// processing to close the race window between the last empty poll and setting
// draining = false.
export async function triggerDrain() {
  if (draining) {
    pendingDrain = true;
    return;
  }
  draining = true;
  try {
    do {
      pendingDrain = false;
      let count: number;
      do {
        count = await processOutboxBatch();
      } while (count > 0);
    } while (pendingDrain);
  } finally {
    draining = false;
  }
}

export function startOutboxWorker() {
  if (timer) {
    return;
  }
  void triggerDrain();
  // Safety net: catches events missed during listener reconnects or in multi-instance
  // setups where the notifying instance differs from the listening one.
  timer = setInterval(() => void triggerDrain(), 30_000);
}

export function stopOutboxWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
