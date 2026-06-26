#!/usr/bin/env bash
# WAL-G Backup-Wrapper: erstellt ein FULL- oder DELTA-Backup, verifiziert es,
# wendet die Retention an (Standard: 4 Full-Backup-Ketten) und erzwingt
# anschließend ein Größen-Budget, damit der S3-Bucket die 2-GB-Grenze nicht
# überschreitet.
#
# Aufruf (siehe crontab):
#   backup.sh full    → vollständiges Basis-Backup  (wöchentlich, So)
#   backup.sh delta   → Differenz seit letztem Full (täglich, Mo–Sa)
#
# Konfigurierbar über Environment (in compose gesetzt, siehe walg-backup-Service):
#   RETAIN_FULL       Anzahl der FULL-Ketten, die behalten werden (Default 4)
#   MAX_BACKUP_BYTES  Maximale Gesamtbelegung im Bucket in Bytes.
#                     Default 1_800_000_000 (~1,8 GB) → Headroom unter 2 GB für
#                     WAL-Segmente, die bis zum nächsten Lauf dazukommen.
set -euo pipefail

MODE="${1:-delta}"
export PGDATA="${PGDATA:-/var/lib/postgresql/data}"

RETAIN_FULL="${RETAIN_FULL:-4}"
MAX_BACKUP_BYTES="${MAX_BACKUP_BYTES:-1800000000}"

log() { echo "[walg-backup $(date -u +%FT%TZ)] $*"; }

# aws-cli-Aufruf inkl. optionalem Endpoint/Region (für S3-kompatible Provider).
aws_cli() {
  aws ${AWS_ENDPOINT:+--endpoint-url "$AWS_ENDPOINT"} ${AWS_REGION:+--region "$AWS_REGION"} "$@"
}

# Gesamtgröße aller Objekte unter WALG_S3_PREFIX in Bytes.
# Gibt -1 zurück, wenn keine Messung möglich ist (aws-cli/Prefix fehlt).
bucket_size_bytes() {
  if ! command -v aws >/dev/null 2>&1 || [ -z "${WALG_S3_PREFIX:-}" ]; then
    echo "-1"
    return 0
  fi
  aws_cli s3 ls "${WALG_S3_PREFIX%/}/" --recursive --summarize 2>/dev/null \
    | awk '/Total Size:/ {print $NF}'
}

# Senkt die Retention schrittweise, bis die Bucket-Belegung unter dem Budget liegt.
enforce_size_budget() {
  local retain="$RETAIN_FULL"
  while :; do
    local used
    used="$(bucket_size_bytes)"
    if [ -z "$used" ] || [ "$used" = "-1" ]; then
      log "Größenermittlung nicht möglich (aws-cli/WALG_S3_PREFIX fehlt) — Size-Budget übersprungen."
      return 0
    fi
    log "Bucket-Belegung: $((used / 1000 / 1000)) MB / Budget $((MAX_BACKUP_BYTES / 1000 / 1000)) MB"
    if [ "$used" -le "$MAX_BACKUP_BYTES" ]; then
      return 0
    fi
    if [ "$retain" -le 1 ]; then
      log "WARNUNG: Budget weiterhin überschritten, aber nur noch 1 FULL-Kette vorhanden."
      log "         Bitte Bucket-Quota erhöhen oder DB-Größe prüfen."
      return 0
    fi
    retain=$((retain - 1))
    log "Budget überschritten → Retention auf $retain FULL-Kette(n) senken und Älteres löschen."
    wal-g delete retain FULL "$retain" --confirm
  done
}

case "$MODE" in
  full)
    log "Starte FULL-Backup (--full erzwingt eine neue Basis-Kette)"
    wal-g backup-push "$PGDATA" --full
    ;;
  delta)
    # Ohne --full erstellt WAL-G automatisch ein Delta zum letzten Backup,
    # solange WALG_DELTA_MAX_STEPS > 0 ist und eine Basis existiert.
    log "Starte DELTA-Backup (Differenz seit letztem Full)"
    wal-g backup-push "$PGDATA"
    ;;
  *)
    echo "Unbekannter Modus: '$MODE' (erwartet: full | delta)" >&2
    exit 2
    ;;
esac

# Verifikation: das soeben erstellte Backup muss in der Liste auftauchen.
log "Verifiziere Backups im Bucket:"
if ! wal-g backup-list; then
  log "FEHLER: backup-list fehlgeschlagen — Backup ggf. nicht im Bucket angekommen!"
  exit 1
fi

# Retention: behalte die letzten RETAIN_FULL FULL-Backups inkl. der daran
# hängenden Delta-Backups; alles Ältere (Backups UND obsolete WAL-Segmente) löschen.
log "Wende Retention an (behalte $RETAIN_FULL FULL-Ketten)"
wal-g delete retain FULL "$RETAIN_FULL" --confirm

# Größen-Budget durchsetzen, damit der 2-GB-Bucket nicht vollläuft.
enforce_size_budget

log "Erledigt ($MODE)"
