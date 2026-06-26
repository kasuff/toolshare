# Alertmanager als Brücke Prometheus → GitLab.
#
# Die GitLab-Webhook-URL + der Auth-Key sind Secrets und kommen erst zur Laufzeit
# aus dem Env (monitoring/.env ← CI/CD-Variablen, via deploy-prod.sh). Da
# Alertmanager keine Env-Expansion in seiner Config beherrscht, rendert
# entrypoint.sh die Config beim Start per sed aus einem Template (busybox-sed ist
# im offiziellen Image vorhanden — kein zusätzliches Tooling nötig).
FROM prom/alertmanager:v0.27.0

COPY alertmanager.yml.tpl /etc/alertmanager/alertmanager.yml.tpl
COPY entrypoint.sh /bin/render-and-run.sh

ENTRYPOINT ["/bin/render-and-run.sh"]
