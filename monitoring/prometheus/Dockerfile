# Prometheus mit eingebackener Config.
# Grund: Im CI-Deploy (Docker-Socket-Binding) laufen Job-Container und Daemon
# auf getrennten Dateisystemen → Repo-relative Bind-Mounts schlagen fehl.
# Daher werden Config + Alert-Regeln direkt ins Image kopiert statt gemountet.
FROM prom/prometheus:v2.53.0

COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY alerts/ /etc/prometheus/alerts/
