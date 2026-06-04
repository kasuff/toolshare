import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { metricsMiddleware } from "./middleware/metrics.middleware";
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
import { metricsRegistry } from "./utils/metrics";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(morgan("dev"));
  app.use(express.json({ limit: "10mb" }));

  // Prometheus-Metriken: vor den API-Routen, damit alle Requests erfasst werden
  app.use(metricsMiddleware);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Prometheus scrape endpoint – nur intern erreichbar (kein Rate-Limit nötig)
  app.get("/metrics", async (_req, res) => {
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

  app.use(errorHandler);

  return app;
};
