# Grafana mit eingebackenem Provisioning + Dashboards (siehe prometheus/Dockerfile).
# Dashboards liegen unter /etc/grafana/dashboards statt /var/lib/grafana/dashboards,
# da Letzteres vom grafana-data-Volume überlagert würde. Der Provisioning-Provider
# (provisioning/dashboards/dashboards.yml) zeigt entsprechend auf diesen Pfad.
FROM grafana/grafana:11.6.16

COPY provisioning/ /etc/grafana/provisioning/
COPY dashboards/ /etc/grafana/dashboards/
