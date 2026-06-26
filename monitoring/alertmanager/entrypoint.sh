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

exec /bin/alertmanager \
  --config.file="$OUT" \
  --storage.path=/alertmanager
