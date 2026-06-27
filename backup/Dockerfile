# Custom Postgres-Image mit WAL-G (Backups) und supercronic (Cron im Container).
#
# Wird von ZWEI Services in docker-compose.prod.yml genutzt:
#   - db          → liefert das wal-g-Binary für archive_command (WAL-Archivierung)
#   - walg-backup → führt backup-push (Full/Delta) + Retention per Cron aus
#
# Base = Debian (bookworm), NICHT alpine: die offiziellen WAL-G-Binaries sind
# gegen glibc gelinkt und laufen nicht auf musl/alpine.
#
# Architektur: TARGETARCH wird von BuildKit automatisch gesetzt (amd64|arm64).
# Daraus werden die passenden Release-Assets gewählt — der Build läuft also
# sowohl auf x86- als auch auf ARM-Servern ohne Anpassung.

FROM postgres:16-bookworm

ARG WALG_VERSION=v3.0.3
ARG SUPERCRONIC_VERSION=v0.2.33
# Von BuildKit gesetzt; Fallback amd64, falls ohne BuildKit gebaut wird.
ARG TARGETARCH=amd64

RUN set -eux; \
    apt-get update; \
    # Sicherheits-Updates der Base-Layer einziehen (z. B. libgnutls30), damit das
    # ausgelieferte Image nicht auf den Rebuild des Upstream-Tags warten muss.
    apt-get upgrade -y; \
    # awscli: nur zum Messen der Bucket-Belegung (Size-Budget in backup.sh).
    apt-get install -y --no-install-recommends ca-certificates curl awscli; \
    # Asset-Namen je Architektur auflösen: WAL-G nutzt "aarch64", supercronic "arm64".
    case "$TARGETARCH" in \
      amd64) WALG_ARCH=amd64;   SUPERCRONIC_ARCH=amd64 ;; \
      arm64) WALG_ARCH=aarch64; SUPERCRONIC_ARCH=arm64 ;; \
      *) echo "Nicht unterstützte Architektur: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    # WAL-G (Postgres-Variante, statisch gegen glibc)
    curl -fsSL -o /tmp/wal-g.tar.gz \
      "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-ubuntu-20.04-${WALG_ARCH}.tar.gz"; \
    tar -xzf /tmp/wal-g.tar.gz -C /usr/local/bin; \
    mv "/usr/local/bin/wal-g-pg-ubuntu-20.04-${WALG_ARCH}" /usr/local/bin/wal-g; \
    chmod +x /usr/local/bin/wal-g; \
    # supercronic: cron-Daemon, der für Container gebaut ist (läuft als non-root, loggt nach stdout)
    curl -fsSL -o /usr/local/bin/supercronic \
      "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${SUPERCRONIC_ARCH}"; \
    chmod +x /usr/local/bin/supercronic; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /tmp/wal-g.tar.gz /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Konfiguration INS IMAGE backen statt per Bind-Mount aus dem Repo-Checkout.
# Grund: Der CI-Deploy läuft aus dem flüchtigen GitLab-Checkout (/builds/...).
# Ein relativer Bind (./backup/postgresql.conf) zeigt auf diesen Pfad; wird der
# Checkout aufgeräumt, legt Docker beim nächsten Container-Neustart ein leeres
# VERZEICHNIS an → Postgres parst ein Dir als Config → Crash-Loop. Im Image
# eingebacken sind beide Dateien immer vorhanden und der Deploy reproduzierbar.
#   - postgresql.conf → db (config_file: wal_level/archive_mode/archive_command)
#   - crontab         → walg-backup (supercronic-Zeitplan Full/Delta)
COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY crontab /etc/supercronic/crontab
