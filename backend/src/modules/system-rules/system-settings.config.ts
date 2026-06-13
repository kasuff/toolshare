// Kanonische Definition der plattformweiten Systemeinstellungen.
// Label und Einheit sind fest – Admins dürfen ausschließlich den Zahlenwert ändern.
// Der Wert wird in der Tabelle SystemSetting (key -> value) persistiert; fehlt ein
// Eintrag, gilt der hier hinterlegte defaultValue.
//
// enforced = true bedeutet: die Regel wird in der Geschäftslogik aktiv durchgesetzt
// (aktuell die buchungsbezogenen Regeln). Nur diese Regeln werden angezeigt und
// editierbar gemacht – siehe ENFORCED_SETTING_DEFS.

export type SystemSettingKey =
  | "maxLoanDurationDays"
  | "minBookingLeadTimeHours"
  | "maxAdvanceBookingDays"
  | "maxConcurrentLoansPerUser"
  | "unansweredRequestExpiryHours"
  | "warningsUntilSuspension"
  | "temporarySuspensionDurationDays"
  | "maxSearchRadiusKm"
  | "maxActiveOffersPerUser";

export type SystemSettingDef = {
  key: SystemSettingKey;
  label: string;
  unit: string;
  defaultValue: number;
  min: number;
  max: number;
  enforced: boolean;
};

export const SYSTEM_SETTING_DEFS: readonly SystemSettingDef[] = [
  {
    key: "maxLoanDurationDays",
    label: "Maximale Ausleihdauer eines Werkzeugs",
    unit: "Tage",
    defaultValue: 14,
    min: 1,
    max: 365,
    enforced: true
  },
  {
    key: "minBookingLeadTimeHours",
    label: "Minimaler Vorlauf für eine Buchung",
    unit: "Stunden",
    defaultValue: 12,
    min: 0,
    max: 720,
    enforced: true
  },
  {
    key: "maxAdvanceBookingDays",
    label: "Maximale Vorausbuchungszeit",
    unit: "Tage",
    defaultValue: 60,
    min: 1,
    max: 365,
    enforced: true
  },
  {
    key: "maxConcurrentLoansPerUser",
    label: "Maximale Anzahl gleichzeitiger Ausleihen pro Nutzer",
    unit: "",
    defaultValue: 5,
    min: 1,
    max: 100,
    enforced: false
  },
  {
    key: "unansweredRequestExpiryHours",
    label: "Ablaufzeit unbeantworteter Anfragen",
    unit: "Stunden",
    defaultValue: 48,
    min: 1,
    max: 720,
    enforced: false
  },
  {
    key: "warningsUntilSuspension",
    label: "Anzahl der Ermahnungen bis zur Kontosperrung",
    unit: "",
    defaultValue: 3,
    min: 1,
    max: 20,
    enforced: false
  },
  {
    key: "temporarySuspensionDurationDays",
    label: "Dauer einer vorübergehenden Kontosperrung",
    unit: "Tage",
    defaultValue: 7,
    min: 1,
    max: 365,
    enforced: false
  },
  {
    key: "maxSearchRadiusKm",
    label: "Maximaler Suchradius",
    unit: "Kilometer",
    defaultValue: 20,
    min: 1,
    max: 500,
    enforced: false
  },
  {
    key: "maxActiveOffersPerUser",
    label: "Maximale Anzahl aktiver Angebote pro Nutzer",
    unit: "",
    defaultValue: 20,
    min: 1,
    max: 1000,
    enforced: false
  }
] as const;

// Nur die Regeln, die tatsächlich durchgesetzt werden. Diese werden angezeigt
// und sind editierbar.
export const ENFORCED_SETTING_DEFS: readonly SystemSettingDef[] = SYSTEM_SETTING_DEFS.filter(
  (def) => def.enforced
);

export const SYSTEM_SETTING_DEF_BY_KEY: Record<SystemSettingKey, SystemSettingDef> =
  SYSTEM_SETTING_DEFS.reduce(
    (acc, def) => {
      acc[def.key] = def;
      return acc;
    },
    {} as Record<SystemSettingKey, SystemSettingDef>
  );

export const SYSTEM_SETTING_KEYS = SYSTEM_SETTING_DEFS.map((def) => def.key) as SystemSettingKey[];

export function isSystemSettingKey(value: string): value is SystemSettingKey {
  return Object.prototype.hasOwnProperty.call(SYSTEM_SETTING_DEF_BY_KEY, value);
}

export function isEnforcedSettingKey(value: string): value is SystemSettingKey {
  return isSystemSettingKey(value) && SYSTEM_SETTING_DEF_BY_KEY[value].enforced;
}

// Vollständiges Setting inkl. aufgelöstem Wert, wie es an die API ausgeliefert wird.
export type SystemSetting = SystemSettingDef & { value: number };
