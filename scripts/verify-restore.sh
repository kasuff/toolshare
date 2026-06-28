#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Restore-Verifikation: holt das jüngste WAL-G-Backup aus dem R2/S3-Bucket in
# einen WEGWERF-Postgres, spielt die WALs ein und prüft, dass echte Daten da
# sind. "Ein Backup ist erst ein Backup, wenn der Restore getestet wurde."
#
# Fasst das produktive pgdata-Volume NICHT an: alles läuft in einem eigenen
# temporären Volume + Wegwerf-Container, der am Ende immer aufgeräumt wird.
#
# Voraussetzungen (wie walg-backup in docker-compose.prod.yml):
#   R2_BACKUP_BUCKET, R2_ACCOUNT_ID, R2_BACKUP_ACCESS_KEY_ID,
#   R2_BACKUP_SECRET_ACCESS_KEY  müssen im Env gesetzt sein.
#   Das Image toolshare-pg-walg:local muss existieren (vom letzten Deploy).
#
# Aufruf:  scripts/verify-restore.sh
# Exit 0 = Restore erfolgreich verifiziert; != 0 = Fehler.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

IMAGE="${RESTORE_IMAGE:-toolshare-pg-walg:local}"
CONTAINER="toolshare-restore-test-$$"
VOLUME="toolshare-restore-test-$$"
# Geteiltes Heartbeat-Volume (von deploy-prod.sh angelegt). node-exporter liest
# es read-only und Prometheus alarmiert auf veraltete Restore-Tests.
METRICS_VOLUME="${RESTORE_METRICS_VOLUME:-toolshare-backup-metrics}"

log() { echo "[verify-restore $(date -u +%FT%TZ)] $*"; }

# Schreibt nach einem erfolgreichen Restore-Test eine node-exporter-Textfile-
# Metrik ins geteilte Volume — dieselbe Konvention wie backup.sh. So unterscheidet
# das Monitoring "Backup gepusht" (toolshare_backup_*) von "Restore nachweislich
# wiederherstellbar" (toolshare_restore_verify_*). No-op, wenn das Volume fehlt
# (z. B. lokaler Lauf ohne Monitoring-Stack) — die Verifikation selbst hängt nie
# an der Metrik.
write_restore_metric() {
	if ! docker volume inspect "$METRICS_VOLUME" >/dev/null 2>&1; then
		log "Hinweis: Volume $METRICS_VOLUME fehlt — Restore-Heartbeat-Metrik übersprungen."
		return 0
	fi
	now="$(date +%s)"
	# Atomar in einem Wegwerf-Container schreiben (erst .tmp, dann mv).
	if docker run --rm -v "${METRICS_VOLUME}:/m" alpine:3 sh -c '
		now="$1"; f=/m/toolshare_restore_verify.prom; t="/m/.toolshare_restore_verify.$$"
		{
			printf "%s\n" "# HELP toolshare_restore_verify_last_success_timestamp_seconds Unix-Zeit der letzten erfolgreichen WAL-G-Restore-Verifikation."
			printf "%s\n" "# TYPE toolshare_restore_verify_last_success_timestamp_seconds gauge"
			printf "%s\n" "toolshare_restore_verify_last_success_timestamp_seconds ${now}"
		} >"$t" && mv -f "$t" "$f"
	' _ "$now" >/dev/null 2>&1; then
		log "Restore-Heartbeat-Metrik aktualisiert ($now)."
	else
		log "WARN: Restore-Heartbeat-Metrik konnte nicht geschrieben werden."
	fi
}

# Pflicht-Variablen prüfen, bevor irgendetwas gestartet wird.
: "${R2_BACKUP_BUCKET:?R2_BACKUP_BUCKET muss gesetzt sein}"
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID muss gesetzt sein}"
: "${R2_BACKUP_ACCESS_KEY_ID:?R2_BACKUP_ACCESS_KEY_ID muss gesetzt sein}"
: "${R2_BACKUP_SECRET_ACCESS_KEY:?R2_BACKUP_SECRET_ACCESS_KEY muss gesetzt sein}"

cleanup() {
	log "Räume auf (Container + temporäres Volume)..."
	docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
	docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

log "Erstelle temporäres Volume $VOLUME"
docker volume create "$VOLUME" >/dev/null

# Restore + Verifikation laufen komplett im Container. wal-g/pg_ctl/psql werden
# via gosu als postgres-User ausgeführt (gosu erhält das Env mit den WAL-G/R2-
# Variablen). Bei jedem Schritt bricht set -e den Lauf ab → Exit != 0.
INNER='
set -eu
export PGDATA=/restore/data
mkdir -p "$PGDATA"
chown -R postgres:postgres /restore
chmod 700 "$PGDATA"

# Superuser/DB des wiederhergestellten Clusters (= prod POSTGRES_USER/DB).
# Ohne -U würde psql die OS-Rolle "postgres" annehmen, die im Backup nicht
# existiert (prod-Superuser ist "toolshare") → FATAL: role "postgres" does not exist.
DBUSER="${DBUSER:-toolshare}"
DBNAME="${DBNAME:-toolshare}"

echo "→ Verfügbare Backups im Bucket:"
gosu postgres wal-g backup-list

echo "→ Hole jüngstes Backup (LATEST)..."
gosu postgres wal-g backup-fetch "$PGDATA" LATEST

echo "→ Aktiviere WAL-Replay (PITR bis Ende der WAL-Kette)..."
gosu postgres sh -c "echo \"restore_command = '"'"'wal-g wal-fetch %f %p'"'"'\" >> \"$PGDATA/postgresql.auto.conf\""
gosu postgres touch "$PGDATA/recovery.signal"

echo "→ Starte Postgres (spielt WALs ein, verlässt Recovery automatisch)..."
gosu postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=127.0.0.1" -w -t 180 start

echo "→ Verifiziere: Schema vorhanden?"
TABLES=$(gosu postgres psql -U "$DBUSER" -d "$DBNAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='"'"'public'"'"'")
echo "   public-Tabellen: $TABLES"
[ "$TABLES" -gt 0 ] || { echo "FEHLER: keine Tabellen im wiederhergestellten Schema"; exit 1; }

echo "→ Verifiziere: fachliche Daten (User-Tabelle) abfragbar?"
USERS=$(gosu postgres psql -U "$DBUSER" -d "$DBNAME" -tAc "SELECT count(*) FROM \"User\"")
echo "   User-Datensätze: $USERS"

gosu postgres pg_ctl -D "$PGDATA" -w -t 60 stop || true
echo "RESTORE OK"
'

log "Starte Wegwerf-Container für den Restore..."
docker run --rm \
	--name "$CONTAINER" \
	-e WALG_S3_PREFIX="s3://${R2_BACKUP_BUCKET}" \
	-e AWS_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
	-e AWS_REGION="auto" \
	-e AWS_ACCESS_KEY_ID="${R2_BACKUP_ACCESS_KEY_ID}" \
	-e AWS_SECRET_ACCESS_KEY="${R2_BACKUP_SECRET_ACCESS_KEY}" \
	-e AWS_S3_FORCE_PATH_STYLE="true" \
	-e WALG_COMPRESSION_METHOD="brotli" \
	-e DBUSER="${RESTORE_DB_USER:-toolshare}" \
	-e DBNAME="${RESTORE_DB_NAME:-toolshare}" \
	-v "${VOLUME}:/restore" \
	--entrypoint sh \
	"$IMAGE" -c "$INNER"

log "Restore-Verifikation erfolgreich abgeschlossen."

# Erst NACH erfolgreichem Restore den Heartbeat erneuern (set -e hätte oben sonst
# schon abgebrochen) → die Metrik beweist einen echten, geprüften Restore.
write_restore_metric
