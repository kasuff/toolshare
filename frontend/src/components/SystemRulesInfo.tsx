import { useEffect, useState } from "react";
import { api, type SystemSetting } from "@toolshare/shared";

type Props = {
  token: string;
  /** Optional: nur diese Keys (in dieser Reihenfolge) anzeigen. Ohne Angabe: alle Regeln. */
  keys?: string[];
  title?: string;
};

// Zeigt die plattformweiten Systemregeln als Info-Box an (z.B. für Werkzeug-Anbieter).
// Die Werte werden live aus den Admin-Einstellungen geladen, damit Änderungen sofort sichtbar sind.
export function SystemRulesInfo({ token, keys, title = "Plattformregeln" }: Props) {
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
    <details className="system-rules-info">
      <summary className="system-rules-info-summary">
        <span className="material-symbols-outlined" aria-hidden="true">
          info
        </span>
        <span className="system-rules-info-title">{title}</span>
        <span className="material-symbols-outlined system-rules-info-chevron" aria-hidden="true">
          expand_more
        </span>
      </summary>
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
    </details>
  );
}
