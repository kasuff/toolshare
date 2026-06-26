import { createApp } from "./app";
import { env } from "./config/env";
import { startOutboxListener } from "./infrastructure/outbox/outbox.listener";
import { startOutboxWorker } from "./infrastructure/outbox/outbox.worker";
import { initInboxEventBus } from "./modules/inbox/inbox.events";
import { bootstrapManagerAllowlist } from "./modules/users/manager-allowlist.bootstrap";

const start = async () => {
  await bootstrapManagerAllowlist();

  if (process.env.NODE_ENV !== "test") {
    startOutboxWorker();
    await startOutboxListener();
    await initInboxEventBus();
  }

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.port}`);
  });
};

void start();
