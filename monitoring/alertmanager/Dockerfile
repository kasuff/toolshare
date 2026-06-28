# Alertmanager als Brücke Prometheus → GitLab.
#
# Die GitLab-Webhook-URL + der Auth-Key sind Secrets und kommen erst zur Laufzeit
# aus dem Env (monitoring/.env ← CI/CD-Variablen, via deploy-prod.sh). Da
# Alertmanager keine Env-Expansion in seiner Config beherrscht, rendert
# entrypoint.sh die Config beim Start per sed aus einem Template (busybox-sed ist
# im offiziellen Image vorhanden — kein zusätzliches Tooling nötig).
FROM prom/alertmanager:v0.28.1

COPY alertmanager.yml.tpl /etc/alertmanager/alertmanager.yml.tpl
COPY entrypoint.sh /bin/render-and-run.sh

# Explizit non-root (entspricht dem Default des Upstream-Images). entrypoint.sh
# schreibt nur nach /tmp und /alertmanager, die für nobody beschreibbar sind.
USER nobody

ENTRYPOINT ["/bin/render-and-run.sh"]
