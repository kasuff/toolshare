import cors from "cors";
import express from "express";
import helmet from "helmet";
import { refreshOutboxMetrics } from "./infrastructure/outbox/outbox.metrics";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { httpLogger } from "./middleware/http-logger.middleware";
import { metricsMiddleware } from "./middleware/metrics.middleware";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import { apiRateLimiter } from "./middleware/rate-limit";
import { addressRouter } from "./modules/address/address.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { bookingsRouter } from "./modules/bookings/bookings.routes";
import { moderationRouter } from "./modules/moderation/moderation.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { ratingsRouter } from "./modules/ratings/ratings.routes";
import { toolsRouter } from "./modules/tools/tools.routes";
import { usersRouter } from "./modules/users/users.routes";
import { workshopsRouter } from "./modules/workshops/workshops.routes";
import { monitoringRouter } from "./modules/monitoring/monitoring.routes";
import { systemRulesRouter } from "./modules/system-rules/system-rules.routes";
import { healthRepository } from "./modules/health/health.repository";
import { metricsRegistry } from "./utils/metrics";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(httpLogger);
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: "10mb" }));

  // Prometheus-Metriken: vor den API-Routen, damit alle Requests erfasst werden
  app.use(metricsMiddleware);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/health/ready", async (_req, res) => {
    const report = await healthRepository.getReadiness();
    res.status(report.ready ? 200 : 503).json({
      status: report.ready ? "ready" : "not_ready",
      checks: report.checks,
      outbox: report.outbox
    });
  });

  // Prometheus scrape endpoint – nur intern erreichbar (kein Rate-Limit nötig)
  app.get("/metrics", async (_req, res) => {
    await refreshOutboxMetrics();
    res.set("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });

  app.use("/api", apiRateLimiter);

  app.use("/api/address", addressRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/moderation", moderationRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/tools", toolsRouter);
  app.use("/api/workshops", workshopsRouter);
  app.use("/api/ratings", ratingsRouter);
  app.use("/api/monitoring", monitoringRouter);
  app.use("/api/system-rules", systemRulesRouter);

  app.use(errorHandler);

  return app;
};
