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
  routes:
    # Dead-Man's-Switch: der immer feuernde Watchdog-Alert darf NICHT zu GitLab
    # (sonst Dauer-Incident). Er geht an den externen Heartbeat-Dienst und wird
    # solange die Pipeline lebt im Minutentakt erneuert. group_wait: 0s → der
    # erste Ping kommt sofort; repeat_interval: 1m → regelmäßiger Heartbeat.
    - receiver: deadmansswitch
      matchers:
        - alertname = "Watchdog"
      group_wait: 0s
      group_interval: 1m
      repeat_interval: 1m

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

  # Externer Heartbeat-Empfänger für den Watchdog. entrypoint.sh füllt die
  # webhook_configs aus WATCHDOG_HEARTBEAT_URL. Ist die URL nicht gesetzt, bleibt
  # hier nur der Name stehen → ein gültiger No-op-Receiver (der Watchdog wird
  # verworfen, der Deploy läuft trotzdem). Diese Zeile wird ersetzt/entfernt:
  - name: deadmansswitch
__WATCHDOG_WEBHOOK_CONFIGS__
