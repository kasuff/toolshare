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
