import { Request, Response, NextFunction } from "express";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestSizeBytes,
  activeUsersGauge
} from "../utils/metrics";

// Aktive Benutzer-Tracking: setzt Gauge auf Basis eines rollierenden Zeitfensters
const recentUsers = new Set<string>();
setInterval(() => {
  activeUsersGauge.set(recentUsers.size);
  recentUsers.clear();
}, 5 * 60 * 1000);

// Normalisiert Express-Routen für Prometheus-Labels (verhindert hohe Kardinalität).
// Ersetzt dynamische Segmente wie /users/123/tools durch /users/:id/tools.
function normalizeRoute(req: Request): string {
  // req.route?.path ist nur innerhalb eines Handlers gesetzt.
  // Als Fallback verwenden wir den URL-Pfad mit Normalisierung.
  if (req.route?.path) {
    const baseUrl = req.baseUrl ?? "";
    return baseUrl + req.route.path;
  }
  // Zahlen, UUIDs und lange Hex-Strings ersetzen
  return req.path
    .replace(/\/\d+/g, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:uuid");
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Request-Größe erfassen
  const requestSize = parseInt(req.headers["content-length"] ?? "0", 10);

  res.on("finish", () => {
    const route = normalizeRoute(req);
    const method = req.method;
    const statusCode = String(res.statusCode);
    const durationSec = (Date.now() - startTime) / 1000;

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route }, durationSec);

    if (requestSize > 0) {
      httpRequestSizeBytes.observe({ method, route }, requestSize);
    }

    // Aktive Benutzer (anhand JWT-User-ID oder IP)
    const userId = (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? "anon";
    recentUsers.add(userId);
  });

  next();
};