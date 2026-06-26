#!/bin/sh
# Rendert die Alertmanager-Config aus dem Template und startet Alertmanager.
# Alertmanager kann keine Env-Variablen in der Config expandieren → wir ersetzen
# die beiden GitLab-Secrets (Webhook-URL + Auth-Key) hier zur Laufzeit per sed.
set -eu

: "${GITLAB_ALERT_WEBHOOK_URL:?GITLAB_ALERT_WEBHOOK_URL muss gesetzt sein}"
: "${GITLAB_ALERT_AUTH_KEY:?GITLAB_ALERT_AUTH_KEY muss gesetzt sein}"

TPL=/etc/alertmanager/alertmanager.yml.tpl
OUT=/tmp/alertmanager.yml

# Sonderzeichen escapen, die sed im Ersetzungstext interpretiert: & \ und das
# Trennzeichen #. So bleiben URL/Key auch mit solchen Zeichen unversehrt.
esc() { printf '%s' "$1" | sed -e 's/[&\\#]/\\&/g'; }
url="$(esc "$GITLAB_ALERT_WEBHOOK_URL")"
key="$(esc "$GITLAB_ALERT_AUTH_KEY")"

sed -e "s#__GITLAB_ALERT_WEBHOOK_URL__#${url}#g" \
    -e "s#__GITLAB_ALERT_AUTH_KEY__#${key}#g" \
    "$TPL" >"$OUT"

# ── Dead-Man's-Switch (optional) ──────────────────────────────────────────────
# Ist WATCHDOG_HEARTBEAT_URL gesetzt, bekommt der deadmansswitch-Receiver einen
# webhook_config, der den externen Heartbeat-Dienst (z. B. healthchecks.io)
# anpingt. Ohne URL wird die Platzhalterzeile ersatzlos entfernt → ein gültiger
# No-op-Receiver bleibt zurück und der Watchdog wird stillschweigend verworfen.
#
# Der mehrzeilige Ersatzblock wird in eine temporäre Datei geschrieben und mit dem
# portablen sed-Idiom `r DATEI` + `d` an der Platzhalterzeile eingefügt (statt
# Newlines durch awk -v zu schleusen, was busybox-/BSD-awk nicht mitmachen).
WATCHDOG_BLOCK="$(mktemp)"
if [ -n "${WATCHDOG_HEARTBEAT_URL:-}" ]; then
  echo "Dead-Man's-Switch aktiv → Watchdog pingt externen Heartbeat-Dienst."
  {
    printf '    webhook_configs:\n'
    printf '      - url: "%s"\n' "$WATCHDOG_HEARTBEAT_URL"
    printf '        send_resolved: false\n'
  } >"$WATCHDOG_BLOCK"
else
  echo "WATCHDOG_HEARTBEAT_URL nicht gesetzt → Dead-Man's-Switch inaktiv (No-op-Receiver)."
  : >"$WATCHDOG_BLOCK"
fi
sed -e "/__WATCHDOG_WEBHOOK_CONFIGS__/r ${WATCHDOG_BLOCK}" \
    -e "/__WATCHDOG_WEBHOOK_CONFIGS__/d" \
    "$OUT" >"${OUT}.tmp" && mv "${OUT}.tmp" "$OUT"
rm -f "$WATCHDOG_BLOCK"

exec /bin/alertmanager \
  --config.file="$OUT" \
  --storage.path=/alertmanager
