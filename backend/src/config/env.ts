import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET"] as const;

const parseEmailAllowlist = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseCorsOrigins = (value: string | undefined): string[] | true => {
  if (!value || value === "*") {
    return true;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  managerEmailAllowlist: parseEmailAllowlist(process.env.MANAGER_EMAIL_ALLOWLIST),
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  // Fenster von 1 Minute. Das allgemeine API-Limit greift pro authentifiziertem
  // Nutzer (Fallback: pro IP), damit ~150 aktive Nutzer hinter geteilten IPs
  // (NAT/WLAN) sich nicht gegenseitig drosseln.
  rateLimitWindowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_MAX, 300),
  rateLimitAuthMax: parsePositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 50),
  prometheusUrl: process.env.PROMETHEUS_URL ?? "http://prometheus:9090",
  lokiUrl: process.env.LOKI_URL ?? "http://loki:3100",
  doraExporterUrl: process.env.DORA_EXPORTER_URL ?? "http://dora-exporter:9110"
};
