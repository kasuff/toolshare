import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { monitoringRateLimiter } from "../../middleware/rate-limit";
import { requireRole } from "../../middleware/require-role";
import { monitoringController } from "./monitoring.controller";

export const monitoringRouter = Router();

// Alle Monitoring-Routen: MANAGER-Rolle + eigener Rate-Limiter
monitoringRouter.use(monitoringRateLimiter, requireAuth, requireRole("MANAGER"));

monitoringRouter.get("/overview", monitoringController.overview);
monitoringRouter.get("/logs", monitoringController.logs);
monitoringRouter.get("/export", monitoringController.export);
