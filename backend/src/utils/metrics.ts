import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";

// Eigene Registry (isoliert vom globalen Default)
export const metricsRegistry = new Registry();

// Node.js Default-Metriken (Event-Loop-Lag, GC, Heap, Handles …)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "nodejs_",
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// ── HTTP-Metriken ─────────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Gesamtanzahl HTTP-Requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [metricsRegistry]
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "Dauer von HTTP-Requests in Sekunden",
  labelNames: ["method", "route"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
});

export const httpRequestSizeBytes = new Histogram({
  name: "http_request_size_bytes",
  help: "Größe von HTTP-Requests in Bytes",
  labelNames: ["method", "route"] as const,
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [metricsRegistry]
});

// ── Business-Metriken ─────────────────────────────────────────────────────────

export const userRegistrationsTotal = new Counter({
  name: "toolshare_user_registrations_total",
  help: "Gesamtanzahl Benutzerregistrierungen",
  registers: [metricsRegistry]
});

export const userLoginsTotal = new Counter({
  name: "toolshare_user_logins_total",
  help: "Gesamtanzahl Login-Versuche",
  labelNames: ["status"] as const,  // "success" | "failed"
  registers: [metricsRegistry]
});

export const bookingsCreatedTotal = new Counter({
  name: "toolshare_bookings_created_total",
  help: "Gesamtanzahl erstellter Buchungen",
  registers: [metricsRegistry]
});

export const toolsListedGauge = new Gauge({
  name: "toolshare_tools_listed_total",
  help: "Aktuell gelistete Werkzeuge",
  registers: [metricsRegistry]
});

export const activeUsersGauge = new Gauge({
  name: "toolshare_active_users",
  help: "Anzahl Benutzer mit einem Request in den letzten 5 Minuten",
  registers: [metricsRegistry]
});

export const outboxPendingGauge = new Gauge({
  name: "toolshare_outbox_pending_total",
  help: "Ausstehende Outbox-Events (noch nicht verarbeitet)",
  registers: [metricsRegistry]
});

export const outboxDeadLetterGauge = new Gauge({
  name: "toolshare_outbox_dead_letter_total",
  help: "Outbox-Events mit erschöpften Retries",
  registers: [metricsRegistry]
});
