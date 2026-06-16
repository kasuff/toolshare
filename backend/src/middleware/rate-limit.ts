import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// Schlüssel pro authentifiziertem Nutzer, sonst pro IP.
// Das Limit läuft vor der Auth-Middleware, daher wird das Bearer-Token nur
// dekodiert (nicht verifiziert) – für die reine Schlüsselbildung ausreichend:
// ein gefälschtes Token drosselt höchstens den Angreifer selbst.
function userOrIpKey(req: Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const decoded = jwt.decode(authHeader.slice(7));
    if (decoded && typeof decoded === "object" && typeof decoded.userId === "string") {
      return `user:${decoded.userId}`;
    }
  }
  // ipKeyGenerator normalisiert IPv6 auf ein /64-Subnetz (von express-rate-limit empfohlen).
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
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
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
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
