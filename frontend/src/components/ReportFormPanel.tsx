import { Field } from "./ui";

type Props = {
  title: string;
  hint?: string;
  reason: string;
  details: string;
  isSubmitting: boolean;
  submitLabel?: string;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function ReportFormPanel({
  title,
  hint,
  reason,
  details,
  isSubmitting,
  submitLabel = "Meldung absenden",
  onReasonChange,
  onDetailsChange,
  onSubmit,
  onCancel
}: Props) {
  return (
    <div className="report-form-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="report-form-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="report-form-head">
          <h2 id="report-form-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Schließen">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        {hint && <p className="hint">{hint}</p>}
        <Field label="Grund">
          <input
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="z. B. unpassende Inhalte oder Verhalten"
            autoFocus
          />
        </Field>
        <Field label="Details (optional)">
          <textarea
            value={details}
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder="Weitere Hinweise für die Moderation"
            rows={4}
          />
        </Field>
        <div className="row report-form-actions">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isSubmitting}>
            Abbrechen
          </button>
          <button type="button" className="btn" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Wird gesendet…" : submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
