import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { startOutboxWorker, stopOutboxWorker } from "./infrastructure/outbox/outbox.worker";
import { bootstrapManagerAllowlist } from "./modules/users/manager-allowlist.bootstrap";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const start = async () => {
  await bootstrapManagerAllowlist();

  if (process.env.NODE_ENV !== "test") {
    startOutboxWorker();
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "Backend listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down gracefully");
    stopOutboxWorker();
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

void start();
