# Custom Postgres-Image mit WAL-G (Backups) und supercronic (Cron im Container).
#
# Wird von ZWEI Services in docker-compose.prod.yml genutzt:
#   - db          → liefert das wal-g-Binary für archive_command (WAL-Archivierung)
#   - walg-backup → führt backup-push (Full/Delta) + Retention per Cron aus
#
# Base = Debian (bookworm), NICHT alpine: die offiziellen WAL-G-Binaries sind
# gegen glibc gelinkt und laufen nicht auf musl/alpine.
#
# Hinweis Architektur: Die Release-Assets unten sind amd64. Auf arm64-Servern
# müssen WALG_VERSION-Asset und supercronic-URL entsprechend angepasst werden.

FROM postgres:16-bookworm

ARG WALG_VERSION=v3.0.3
ARG SUPERCRONIC_VERSION=v0.2.33

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    # WAL-G (Postgres-Variante, statisch gegen glibc)
    curl -fsSL -o /tmp/wal-g.tar.gz \
      "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-ubuntu-20.04-amd64.tar.gz"; \
    tar -xzf /tmp/wal-g.tar.gz -C /usr/local/bin; \
    mv /usr/local/bin/wal-g-pg-ubuntu-20.04-amd64 /usr/local/bin/wal-g; \
    chmod +x /usr/local/bin/wal-g; \
    # supercronic: cron-Daemon, der für Container gebaut ist (läuft als non-root, loggt nach stdout)
    curl -fsSL -o /usr/local/bin/supercronic \
      "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64"; \
    chmod +x /usr/local/bin/supercronic; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /tmp/wal-g.tar.gz /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
