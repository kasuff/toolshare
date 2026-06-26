# TEMPLATE — wird beim Container-Start von entrypoint.sh gerendert.
# Die Platzhalter __GITLAB_ALERT_WEBHOOK_URL__ / __GITLAB_ALERT_AUTH_KEY__ werden
# durch die GitLab-Secrets aus dem Env ersetzt. NICHT direkt als Config nutzen.
#
# Ziel: GitLab-HTTP-Alert-Integration (Projekt → Settings → Monitor → Alerts →
# Integration "HTTP Endpoint"). GitLab erzeugt daraus Alerts/Incidents und
# verschickt die konfigurierten Benachrichtigungen.
route:
  receiver: gitlab
  # Alerts mit gleichem Namen zusammenfassen, damit GitLab nicht pro Instanz
  # einen eigenen Incident öffnet.
  group_by: ["alertname"]
  group_wait: 30s
  group_interval: 5m
  # Nicht öfter als alle 4h an einen weiterhin offenen Alert erinnern.
  repeat_interval: 4h

receivers:
  - name: gitlab
    webhook_configs:
      - url: "__GITLAB_ALERT_WEBHOOK_URL__"
        # Auch das Abklingen ("resolved") melden, damit GitLab Incidents schließt.
        send_resolved: true
        http_config:
          authorization:
            type: Bearer
            credentials: "__GITLAB_ALERT_AUTH_KEY__"
