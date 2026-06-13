import { useEffect, useState } from "react";
import { api, type SystemSetting } from "../services/api";

type Props = {
  token: string;
  /** Optional: nur diese Keys (in dieser Reihenfolge) anzeigen. Ohne Angabe: alle Regeln. */
  keys?: string[];
  title?: string;
};

// Zeigt die plattformweiten Systemregeln als Info-Box an (z.B. für Werkzeug-Anbieter).
// Die Werte werden live aus den Admin-Einstellungen geladen, damit Änderungen sofort sichtbar sind.
export function SystemRulesInfo({ token, keys, title = "Plattformregeln für dein Angebot" }: Props) {
  const [settings, setSettings] = useState<SystemSetting[]>([]);

  useEffect(() => {
    let active = true;
    api
      .getSystemSettings(token)
      .then((all) => {
        if (active) setSettings(all);
      })
      .catch(() => {
        if (active) setSettings([]);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const visible = keys
    ? keys.map((key) => settings.find((s) => s.key === key)).filter((s): s is SystemSetting => Boolean(s))
    : settings;

  if (visible.length === 0) return null;

  return (
    <aside className="system-rules-info">
      <h2 className="system-rules-info-title">{title}</h2>
      <ul className="system-rules-info-list">
        {visible.map((setting) => (
          <li key={setting.key}>
            <span>{setting.label}:</span>{" "}
            <strong>
              {setting.value}
              {setting.unit ? ` ${setting.unit}` : ""}
            </strong>
          </li>
        ))}
      </ul>
    </aside>
  );
}
