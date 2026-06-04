import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      message: "Zu viele Anfragen. Bitte versuchen Sie es später erneut."
    });
  }
});

export const authRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      message: "Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut."
    });
  }
});

// Monitoring-Proxy: max. 30 Req/min pro IP.
// Jeder Request löst eine Prometheus-/Loki-Abfrage aus — daher strenger begrenzt.
export const monitoringRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT",
        message: "Monitoring-API: zu viele Anfragen. Bitte warte eine Minute.",
        status: 429
      }
    });
  }
});
