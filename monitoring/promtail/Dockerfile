# Promtail mit eingebackener Config (siehe prometheus/Dockerfile zur Begründung).
# Die Host-Mounts (docker.sock, /var/lib/docker/containers, /var/log) bleiben in
# der Compose erhalten – das sind echte Host-Pfade und funktionieren.
FROM grafana/promtail:2.9.8

COPY promtail-config.yml /etc/promtail/promtail-config.yml
