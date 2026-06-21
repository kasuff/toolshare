# Toolshare Observability Stack

Zentrales Monitoring-, Logging- und Reporting-System auf Basis von:

| Komponente    | Rolle                               | Port  |
|---------------|-------------------------------------|-------|
| Grafana       | Dashboards, Reports, Visualisierung | 3001  |
| Prometheus    | Metriken-Speicher & Alerting        | 9090  |
| Loki          | Log-Aggregation (komprimiert)       | 3100  |
| Promtail      | Log-Collector (Docker + Systemlogs) | –     |
| Node Exporter | Host-Metriken (CPU, RAM, Disk, Net) | –     |

---

## Schnellstart (lokal)

```bash
# 1. App-Stack starten (erzeugt das toolshare-network)
docker compose up -d

# 2. Monitoring-Stack starten
cd monitoring
cp .env.example .env      # Passwörter anpassen!
docker compose up -d

# 3. Grafana öffnen
open http://localhost:3001
# Login: admin / admin (oder wie in .env gesetzt)
```

## Produktions-Deployment (Linux-Server)

```bash
# Gleiche Schritte wie lokal – docker compose ist identisch.
# Nur .env anpassen:

GRAFANA_ADMIN_PASSWORD=<sehr-sicheres-passwort>
GRAFANA_ROOT_URL=https://monitoring.yourdomain.com
PROMETHEUS_RETENTION=90d
PROMETHEUS_RETENTION_SIZE=50GB
```

> **Reverse Proxy**: Grafana hinter Nginx/Traefik mit HTTPS betreiben.
> `/metrics` und `:9090` (Prometheus) **nicht** öffentlich exponieren.

---

## Verfügbare Dashboards

| Dashboard           | UID                    | Inhalt                              |
|---------------------|------------------------|-------------------------------------|
| System Overview     | `toolshare-system`     | CPU, RAM, Disk, Netzwerk            |
| Application Metrics | `toolshare-application`| HTTP-Traffic, Fehler, Antwortzeiten |
| Log Analysis        | `toolshare-logs`       | Fehlerlogs, Warnungen, Log-Streams  |
| DORA Metrics        | `toolshare-dora`       | Deployment Freq, Lead Time, CFR, TTR|

---

## DORA-Metriken

Da GitLab **Free** weder die DORA-Charts noch die DORA-API anbietet, berechnet
der `dora-exporter` (Service im Stack) die vier Metriken selbst und stellt sie
als Prometheus-Metriken bereit. Das Dashboard `toolshare-dora` zeigt sie *über
die Zeit*.

| Metrik | Quelle |
|--------|--------|
| Deployment Frequency | GitLab Deployments-API (Production-Environment) |
| Lead Time for Changes | GitLab Deployments-API (Commit → Deploy-Ende) |
| Change Failure Rate | Ausfall-Episoden ÷ Deployments |
| Time to Restore Service | Dauer der Ausfall-Episoden |

### Ausfälle markieren – mit dem geringsten Aufwand

**Default: gar nicht manuell markieren.** `OUTAGE_SOURCE=prometheus_alerts`
leitet Ausfälle automatisch aus den feuernden **kritischen** Prometheus-Alerts
ab (`BackendDown`, `CriticalHttpErrorRate`, …). Jede zusammenhängende
Feuer-Phase = ein Ausfall; ihre Dauer = Time to Restore. Kein Incident-Anlegen,
kein Klick.

> Reichweite ist durch die Prometheus-Retention begrenzt (`PROMETHEUS_RETENTION`,
> Default 30d / prod 90d). Wer längere CFR-Historie braucht, erhöht die Retention
> oder nutzt `OUTAGE_SOURCE=gitlab_incidents` (GitLab-Issues vom Typ *incident*,
> created_at → closed_at).

### Voraussetzungen

1. **Production-Environment** in `.gitlab-ci.yml` mit `deployment_tier: production`
   (sonst zählt GitLab keine Deployments).
2. **GitLab-Token** mit Scope `read_api` als `GITLAB_TOKEN` setzen.

### Konfiguration (`.env`)

```bash
GITLAB_URL=https://gitlab.lrz.de
GITLAB_PROJECT=gruppe/toolshare      # Pfad oder numerische Projekt-ID
GITLAB_TOKEN=glpat-xxxxxxxxxxxx      # Scope: read_api
GITLAB_PRODUCTION_ENV=production     # Name der Production-Environment
DORA_OUTAGE_SOURCE=prometheus_alerts # oder: gitlab_incidents
DORA_OUTAGE_SEVERITY=critical
DORA_WINDOW_DAYS=30                  # rollierendes Fenster für CFR/Frequency
DORA_COLLECT_INTERVAL=300            # Sammel-Intervall in Sekunden
```

### PDF-Export

Der Exporter erzeugt den Report on demand – einfach im Browser öffnen:

```
http://<host>:9110/report.pdf?days=90
```

`?days=` wählt den Zeitraum (1–730). Der PDF enthält Deckblatt (Kennzahlen +
DORA-Einordnung Elite/High/Medium/Low) und vier Wochentrends. Die Daten werden
für den Report direkt aus den Quellen neu berechnet – also auch direkt nach dem
ersten Start vollständig.

> Hinweis: Grafanas eingebautes PDF-*Reporting* ist Enterprise-only; deshalb
> erzeugt der Exporter den PDF selbst (matplotlib), unabhängig von Grafana.

---

## Admin-Portal Integration

### 1. Grafana-Dashboard per iframe einbetten

```html
<!-- Voraussetzung: GF_SECURITY_ALLOW_EMBEDDING=true (bereits gesetzt) -->
<iframe
  src="http://localhost:3001/d/toolshare-system/system-overview?orgId=1&refresh=30s&kiosk"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```

Einzelnes Panel einbetten (Panel-ID aus Grafana "Share > Embed"):

```html
<iframe
  src="http://localhost:3001/d-solo/toolshare-application/application-metrics?orgId=1&panelId=1"
  width="450"
  height="200"
  frameborder="0">
</iframe>
```

**Kiosk-Modi:**
- `?kiosk` – ohne Menü und Header
- `?kiosk=tv` – ohne Navigation, mit Refresh

---

### 2. Daten über die Grafana HTTP API abrufen

```bash
# Authentifizierung: Basic Auth oder API Key
GRAFANA_URL="http://localhost:3001"
AUTH="admin:admin"

# Alle Dashboards auflisten
curl -s -u "$AUTH" "$GRAFANA_URL/api/search" | jq '.[].title'

# Dashboard-JSON exportieren
curl -s -u "$AUTH" "$GRAFANA_URL/api/dashboards/uid/toolshare-system" | jq '.dashboard'

# Annotations (Alert-Ereignisse)
curl -s -u "$AUTH" "$GRAFANA_URL/api/annotations?limit=100"

# Service-Account-Token erzeugen (für Produktions-APIs)
curl -s -u "$AUTH" -X POST "$GRAFANA_URL/api/serviceaccounts" \
  -H "Content-Type: application/json" \
  -d '{"name":"admin-portal","role":"Viewer"}'
```

---

### 3. Daten direkt aus Prometheus abfragen

```bash
PROM="http://localhost:9090"

# Aktueller CPU-Wert
curl -s "$PROM/api/v1/query?query=100-(avg(irate(node_cpu_seconds_total{mode='idle'}[5m]))*100)" \
  | jq '.data.result[0].value[1]'

# Zeitreihe (letzten 30 Minuten, 1-Minuten-Auflösung)
curl -s "$PROM/api/v1/query_range" \
  --data-urlencode 'query=sum(rate(http_requests_total[1m]))*60' \
  --data-urlencode "start=$(date -d '30 minutes ago' +%s)" \
  --data-urlencode "end=$(date +%s)" \
  --data-urlencode "step=60" \
  | jq '.data.result'

# Alle aktiven Alerts
curl -s "$PROM/api/v1/alerts" | jq '.data.alerts'

# Alle verfügbaren Metriken
curl -s "$PROM/api/v1/label/__name__/values" | jq '.data[]' | grep toolshare
```

**JavaScript-Beispiel (Admin-Portal):**

```typescript
async function getRequestRate(): Promise<number> {
  const res = await fetch(
    'http://localhost:9090/api/v1/query?query=sum(rate(http_requests_total[1m]))*60'
  );
  const data = await res.json();
  return parseFloat(data.data.result[0]?.value[1] ?? '0');
}
```

---

### 4. Daten direkt aus Loki abfragen

```bash
LOKI="http://localhost:3100"

# Letzte 100 Fehler-Logs
curl -s -G "$LOKI/loki/api/v1/query_range" \
  --data-urlencode 'query={job="docker"} |= "error"' \
  --data-urlencode "start=$(date -d '1 hour ago' +%s)000000000" \
  --data-urlencode "end=$(date +%s)000000000" \
  --data-urlencode "limit=100" \
  | jq '.data.result[].values[][1]'

# Log-Volumen pro Service (MetricsQuery)
curl -s -G "$LOKI/loki/api/v1/query_range" \
  --data-urlencode 'query=sum by (service) (count_over_time({job="docker"}[5m]))' \
  --data-urlencode "start=$(date -d '1 hour ago' +%s)000000000" \
  --data-urlencode "end=$(date +%s)000000000" \
  --data-urlencode "step=60" \
  | jq '.data.result'
```

---

### 5. Eigenes Dashboard-Frontend (Architektur)

```
Admin Portal (Next.js / React)
├── /dashboard
│   ├── <SystemStatus>       → Prometheus API: CPU, RAM, Disk
│   ├── <RequestMetrics>     → Prometheus API: rate(http_requests_total)
│   ├── <ErrorLog>           → Loki API: {job="docker"} |= "error"
│   └── <GrafanaPanel>       → iframe: /d-solo/toolshare-application/...
├── /reports
│   ├── DailyReport          → Prometheus range query (24h)
│   ├── WeeklyReport         → Prometheus range query (7d)
│   └── MonthlyReport        → Prometheus range query (30d)
└── /alerts
    └── AlertList            → Prometheus /api/v1/alerts
```

**Report-Export (CSV/JSON/PDF):**

```typescript
// JSON-Export: Prometheus-Daten direkt serialisieren
const report = await fetch('/api/v1/query_range?query=...').then(r => r.json());
const json = JSON.stringify(report.data.result, null, 2);

// CSV-Export: Zeitreihen flachklopfen
const csv = report.data.result.flatMap(series =>
  series.values.map(([ts, val]) =>
    `${new Date(ts * 1000).toISOString()},${series.metric.route},${val}`
  )
).join('\n');

// PDF-Export: Grafana Reporting API (Grafana Enterprise)
// Alternativ: puppeteer Screenshot der Grafana-Seite
```

---

## Backup & Restore

```bash
# Grafana-Volumes sichern
docker run --rm \
  -v monitoring_grafana-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/grafana-$(date +%Y%m%d).tar.gz /data

# Prometheus-Daten sichern (Snapshot-API)
curl -X POST http://localhost:9090/api/v1/admin/tsdb/snapshot
# Snapshot liegt in: prometheus-data/snapshots/

# Loki-Chunks sichern
docker run --rm \
  -v monitoring_loki-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/loki-$(date +%Y%m%d).tar.gz /data
```

---

## Verfügbare Prometheus-Metriken (Backend)

| Metrik                                  | Typ       | Beschreibung                      |
|-----------------------------------------|-----------|-----------------------------------|
| `http_requests_total`                   | Counter   | HTTP-Requests nach Route + Status |
| `http_request_duration_seconds`         | Histogram | Antwortzeiten                     |
| `http_request_size_bytes`               | Histogram | Request-Größen                    |
| `toolshare_user_registrations_total`    | Counter   | Neue Registrierungen              |
| `toolshare_user_logins_total`           | Counter   | Logins (success/failed)           |
| `toolshare_bookings_created_total`      | Counter   | Neue Buchungen                    |
| `toolshare_tools_listed_total`          | Gauge     | Aktive Tool-Listings              |
| `toolshare_active_users`               | Gauge     | Aktive User (5-Minuten-Fenster)   |
| `nodejs_*`                              | diverse   | Node.js Runtime-Metriken          |

---

## Konfigurationsdateien

```
monitoring/
├── docker-compose.yml              # Stack-Orchestrierung
├── .env.example                    # Umgebungsvariablen-Template
├── prometheus/
│   ├── prometheus.yml              # Scrape-Targets + Alert-Regeln-Import
│   └── alerts/
│       ├── system.rules.yml        # CPU / RAM / Disk / InstanceDown
│       └── application.rules.yml  # HTTP-Fehlerrate / Antwortzeit
├── loki/
│   └── loki-config.yml             # Snappy-Kompression, 30d Retention
├── promtail/
│   └── promtail-config.yml         # Docker-Log-Discovery + Parsing
└── grafana/
    ├── provisioning/
    │   ├── datasources/
    │   │   └── datasources.yml     # Prometheus + Loki auto-provisioniert
    │   └── dashboards/
    │       └── dashboards.yml      # Dashboard-Loader-Konfiguration
    └── dashboards/
        ├── system.json             # System Overview Dashboard
        ├── application.json        # Application Metrics Dashboard
        └── logs.json               # Log Analysis Dashboard
```
