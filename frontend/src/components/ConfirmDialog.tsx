type Props = {
  title: string;
  text: string;
  confirmLabel: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ title, text, confirmLabel, isBusy = false, onConfirm, onCancel }: Props) {
  return (
    <div className="report-form-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="report-form-panel confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="report-form-head">
          <h2 id="confirm-dialog-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Dialog schließen">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <p id="confirm-dialog-description">{text}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isBusy}>
            Abbrechen
          </button>
          <button type="button" className="btn danger" onClick={onConfirm} disabled={isBusy} autoFocus>
            {isBusy ? "Wird gelöscht..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
