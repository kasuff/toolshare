#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Rollback in unter einer Minute: rollt die App-Images auf den letzten
# funktionierenden Stand (:previous) zurück und fährt den App-Stack damit hoch –
# OHNE neuen Build. Der Monitoring-Stack bleibt unangetastet.
#
# Voraussetzung: ein vorheriger Deploy hat :previous-Images hinterlassen
# (deploy-prod.sh sichert :current → :previous vor jedem Build).
#
# Aufruf:  scripts/rollback-prod.sh
# ─────────────────────────────────────────────────────────────────────────────
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$REPO_ROOT/docker-compose.prod.yml"
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
	file="$1"
	echo "Waiting for containers to become healthy/running ($file)..."
	elapsed=0
	compose="$(compose_cmd)"
	container_ids="$($compose -f "$file" ps -q)"
	if [ -z "$container_ids" ]; then
		echo "No containers found for compose file: $file"
		return 1
	fi
	while [ "$elapsed" -lt "$HEALTHCHECK_TIMEOUT_SECONDS" ]; do
		pending=0
		for id in $container_ids; do
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
			if [ "$health" = "none" ] && [ "$status" = "running" ]; then
				continue
			fi
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

# Beide :previous-Images müssen existieren, sonst gäbe es nichts zum Zurückrollen.
for img in toolshare-frontend toolshare-backend; do
	if ! docker image inspect "${img}:previous" >/dev/null 2>&1; then
		echo "FEHLER: ${img}:previous existiert nicht — kein Rollback möglich." >&2
		echo "        (Ein :previous entsteht erst beim zweiten Deploy.)" >&2
		exit 1
	fi
done

echo "Rolling back app images to :previous..."
for img in toolshare-frontend toolshare-backend; do
	echo "  ${img}:previous -> ${img}:current"
	docker tag "${img}:previous" "${img}:current"
done

COMPOSE="$(compose_cmd)"
echo "Starting app stack on rolled-back images (no build)..."
$COMPOSE -f "$COMPOSE_FILE" up -d --remove-orphans
wait_for_containers "$COMPOSE_FILE"

echo "Rollback finished successfully!"
