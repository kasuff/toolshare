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

# Stop monitoring first — it depends on toolshare-network which the app stack owns
echo "Stopping monitoring stack..."
$COMPOSE -f "$MONITORING_COMPOSE_FILE" down || true

# Stop app stack and recreate network
echo "Stopping app stack..."
$COMPOSE -f "$COMPOSE_FILE" down --remove-orphans

# Start app stack first (creates toolshare-network)
echo "Starting app stack..."
$COMPOSE -f "$COMPOSE_FILE" up -d --build
wait_for_containers "$COMPOSE_FILE"

# Start monitoring stack (joins existing toolshare-network)
# --build: Configs sind in die Images gebacken → bei Änderungen neu bauen.
echo "Starting monitoring stack..."
$COMPOSE -f "$MONITORING_COMPOSE_FILE" up -d --build
wait_for_containers "$MONITORING_COMPOSE_FILE"

echo "Deployment finished successfully!"
