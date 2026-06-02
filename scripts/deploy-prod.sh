#!/bin/sh
set -e

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
	echo "Waiting for containers to become healthy/running..."

	local elapsed=0
	local container_ids
	local compose
	compose="$(compose_cmd)"
	container_ids="$($compose -f "$COMPOSE_FILE" ps -q)"

	if [ -z "$container_ids" ]; then
		echo "No containers found for compose file: $COMPOSE_FILE"
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
	$compose -f "$COMPOSE_FILE" ps
	return 1
}

echo "Starting production deployment..."

# Pull the latest changes from the main branch
git pull origin main

echo "Stopping existing containers..."
COMPOSE="$(compose_cmd)"
$COMPOSE -f "$COMPOSE_FILE" down --remove-orphans

# Use Docker Compose to build and restart services
# The -d flag runs the containers in the background
# --no-deps prevents docker-compose from recreating dependencies (like the database)
# --build forces a rebuild of the images
COMPOSE="$(compose_cmd)"
$COMPOSE -f "$COMPOSE_FILE" up -d --build
wait_for_containers

# Optional: Run database migrations if you have them
# This command assumes your backend service is named 'backend' in the docker-compose file
# and that you have a script for migrations in your package.json
$COMPOSE -f "$COMPOSE_FILE" exec -T backend npm run prisma:migrate

# Run health check again after migrations in case app restarts internally.
wait_for_containers

echo "Deployment finished successfully!"
