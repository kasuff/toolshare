#!/usr/bin/env bash
# WAL-G Backup-Wrapper: erstellt ein FULL- oder DELTA-Backup und wendet
# anschließend die Retention an (4 Full-Backup-Ketten = ~4 Wochen).
#
# Aufruf (siehe crontab):
#   backup.sh full    → vollständiges Basis-Backup  (wöchentlich, So)
#   backup.sh delta   → Differenz seit letztem Full (täglich, Mo–Sa)
set -euo pipefail

MODE="${1:-delta}"
export PGDATA="${PGDATA:-/var/lib/postgresql/data}"

log() { echo "[walg-backup $(date -u +%FT%TZ)] $*"; }

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

# Retention: behalte die letzten 4 FULL-Backups inkl. der daran hängenden
# Delta-Backups; alles Ältere (Backups UND obsolete WAL-Segmente) wird gelöscht.
log "Backup fertig — wende Retention an (behalte 4 FULL-Ketten)"
wal-g delete retain FULL 4 --confirm

log "Erledigt ($MODE)"
