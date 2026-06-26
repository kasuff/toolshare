#!/bin/sh
set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker-compose.prod.yml"
MONITORING_COMPOSE_FILE="$REPO_ROOT/monitoring/docker-compose.yml"
HEALTHCHECK_TIMEOUT_SECONDS="${HEALTHCHECK_TIMEOUT_SECONDS:-180}"
HEALTHCHECK_INTERVAL_SECONDS="${HEALTHCHECK_INTERVAL_SECONDS:-5}"

cd "$REPO_ROOT"

compose_cmd() {
	if command -v docker-compose >/dev/null 2>&1; then
		echo "docker-compose"
		return 0
	fi

	if docker compose version >/dev/null 2>&1; then
		echo "docker compose"
		return 0
	fi

	echo "Neither docker-compose nor docker compose is available" >&2
	return 1
}

wait_for_containers() {
	local file="$1"
	echo "Waiting for containers to become healthy/running ($file)..."

	local elapsed=0
	local container_ids
	local compose
	compose="$(compose_cmd)"
	container_ids="$($compose -f "$file" ps -q)"

	if [ -z "$container_ids" ]; then
		echo "No containers found for compose file: $file"
		return 1
	fi

	while [ "$elapsed" -lt "$HEALTHCHECK_TIMEOUT_SECONDS" ]; do
		local pending=0

		for id in $container_ids; do
			local status
			local health
			local name

			status="$(docker inspect -f '{{.State.Status}}' "$id")"
			health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
			name="$(docker inspect -f '{{.Name}}' "$id" | sed 's#^/##')"

			if [ "$status" = "exited" ] || [ "$status" = "dead" ]; then
				echo "Container $name is in bad state: $status"
				docker logs "$id" --tail 100 || true
				return 1
			fi

			if [ "$health" = "unhealthy" ]; then
				echo "Container $name reported unhealthy"
				docker logs "$id" --tail 100 || true
				return 1
			fi

			# If a container has no healthcheck, consider it ready once it's running.
			if [ "$health" = "none" ] && [ "$status" = "running" ]; then
				continue
			fi

			# If a container has a healthcheck, it must become healthy.
			if [ "$health" != "healthy" ]; then
				pending=1
			fi
		done

		if [ "$pending" -eq 0 ]; then
			echo "All containers are healthy/running."
			return 0
		fi

		sleep "$HEALTHCHECK_INTERVAL_SECONDS"
		elapsed=$((elapsed + HEALTHCHECK_INTERVAL_SECONDS))
		echo "Still waiting... ${elapsed}s/${HEALTHCHECK_TIMEOUT_SECONDS}s"
	done

	echo "Timed out waiting for container health checks"
	$(compose_cmd) -f "$file" ps
	return 1
}

echo "Starting production deployment..."

COMPOSE="$(compose_cmd)"

# Both stacks attach to toolshare-network as an *external* network, so nothing
# in the compose files creates it. Ensure it exists before anything starts.
if ! docker network inspect toolshare-network >/dev/null 2>&1; then
	echo "Creating shared external network toolshare-network..."
	docker network create toolshare-network
fi

# Backup-Heartbeat-Volume: walg-backup (App-Stack) schreibt hier nach jedem
# erfolgreichen Backup eine node-exporter-Textfile-Metrik hinein, node-exporter
# (Monitoring-Stack) liest sie read-only und Prometheus alarmiert, wenn das
# letzte Backup zu alt ist oder ganz fehlt (s. monitoring/prometheus/alerts/
# backup.rules.yml). Beide Compose-Projekte binden das Volume als *external* ein
# → es muss vorab existieren, genau wie das Netz oben.
if ! docker volume inspect toolshare-backup-metrics >/dev/null 2>&1; then
	echo "Creating shared backup-metrics volume toolshare-backup-metrics..."
	docker volume create toolshare-backup-metrics >/dev/null
fi
# Der walg-backup-Container schreibt als nicht-root (user: postgres) → das
# Volume-Wurzelverzeichnis (root:root 0755) world-writable machen. Enthält nur
# eine Heartbeat-Metrik, keine Secrets. Läuft gegen den Daemon (nicht im
# Job-Container-FS), daher hier per Wegwerf-Container statt mkdir/chmod.
docker run --rm -v toolshare-backup-metrics:/m alpine:3 chmod 0777 /m >/dev/null 2>&1 || true

# 0) Rollback-Sicherung: das aktuell laufende App-Image (:current) nach
#    :previous umtaggen, BEVOR der Build es überschreibt. So bleibt das letzte
#    funktionierende Image erhalten und scripts/rollback-prod.sh kann es in
#    Sekunden zurückrollen. Fehlt :current (erster Deploy), wird nur übersprungen.
for img in toolshare-frontend toolshare-backend; do
	if docker image inspect "${img}:current" >/dev/null 2>&1; then
		echo "Sichere ${img}:current -> ${img}:previous"
		docker tag "${img}:current" "${img}:previous"
	fi
done

# 1) Build app images FIRST — before touching anything that is running.
#    If a build fails (e.g. a transient npm-registry ECONNRESET), abort here:
#    the current app keeps serving and, crucially, the monitoring stack
#    (Grafana) is never stopped. Build failures no longer take observability
#    down with them.
echo "Building app images..."
$COMPOSE -f "$COMPOSE_FILE" build

# 2) Roll the app stack onto the freshly built images. up -d recreates only
#    the containers whose image/config changed, minimising downtime.
echo "Starting app stack..."
$COMPOSE -f "$COMPOSE_FILE" up -d --remove-orphans
wait_for_containers "$COMPOSE_FILE"

# 2b) monitoring/.env aus CI/CD-Variablen erzeugen, damit Pipeline- UND
#     manuelle (server-seitige) Deploys dieselbe Quelle nutzen. Läuft nur in
#     der CI ($CI ist von GitLab gesetzt) und schreibt jeden Key nur, wenn ein
#     Wert vorhanden ist → bestehende, von Hand gepflegte Werte in
#     monitoring/.env (z. B. PROMETHEUS_RETENTION) bleiben unangetastet.
if [ -n "${CI:-}" ]; then
	MON_ENV="$REPO_ROOT/monitoring/.env"
	touch "$MON_ENV"

	set_env() {
		key="$1"
		val="$2"
		[ -n "$val" ] || return 0
		tmp="$(mktemp)"
		# bestehende Zeile für den Key entfernen, dann neuen Wert anhängen
		grep -v "^${key}=" "$MON_ENV" >"$tmp" 2>/dev/null || true
		printf '%s=%s\n' "$key" "$val" >>"$tmp"
		mv "$tmp" "$MON_ENV"
	}

	echo "Refreshing monitoring/.env from CI variables..."
	set_env GITLAB_URL "${GITLAB_URL:-$CI_SERVER_URL}"
	set_env GITLAB_PROJECT "${GITLAB_PROJECT:-$CI_PROJECT_PATH}"
	set_env GITLAB_TOKEN "${GITLAB_TOKEN:-}"
	set_env GITLAB_PRODUCTION_ENV "${GITLAB_PRODUCTION_ENV:-}"
	set_env GRAFANA_ADMIN_PASSWORD "${GRAFANA_ADMIN_PASSWORD:-}"
	set_env DORA_OUTAGE_SOURCE "${DORA_OUTAGE_SOURCE:-}"
	# Alertmanager → GitLab (HTTP-Alert-Integration): Webhook-URL + Auth-Key.
	set_env GITLAB_ALERT_WEBHOOK_URL "${GITLAB_ALERT_WEBHOOK_URL:-}"
	set_env GITLAB_ALERT_AUTH_KEY "${GITLAB_ALERT_AUTH_KEY:-}"
fi

# 3) Ensure the monitoring stack is up. It runs as an independent compose
#    project on the same external network, so it is brought up separately and
#    is unaffected by an app build/health failure above.
#    --build: Configs sind in die Images gebacken → bei Änderungen neu bauen.
echo "Building monitoring images..."
$COMPOSE -f "$MONITORING_COMPOSE_FILE" build
echo "Starting monitoring stack..."
$COMPOSE -f "$MONITORING_COMPOSE_FILE" up -d
wait_for_containers "$MONITORING_COMPOSE_FILE"

# 4) Aufräumen: das Re-Tagging (:current → :previous) und jeder neue Build lassen
#    unreferenzierte (dangling) Images zurück. Auf der kleinen VM würde das die
#    Disk über die Zeit volllaufen lassen und irgendwann den nächsten Build (oder
#    Postgres) zum Scheitern bringen. Es werden NUR dangling Images entfernt →
#    :current/:previous/:local bleiben erhalten, das Rollback bleibt möglich.
echo "Pruning dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo "Deployment finished successfully!"
