import { useCallback, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { Field } from "./ui";
import { StarRatingInput } from "./StarRatingInput";

type Props = {
  title: string;
  hint?: string;
  targetLabel: string;
  score: number;
  comment: string;
  isSubmitting: boolean;
  onScoreChange: (score: number) => void;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function RatingFormPanel({
  title,
  hint,
  targetLabel,
  score,
  comment,
  isSubmitting,
  onScoreChange,
  onCommentChange,
  onSubmit,
  onCancel
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeDialog = useCallback(() => onCancel(), [onCancel]);
  useModalFocus(dialogRef, closeDialog, closeButtonRef);

  return (
    <div className="report-form-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="report-form-panel rating-form-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-form-title"
        tabIndex={-1}
      >
        <header className="report-form-head">
          <h2 id="rating-form-title">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Schließen"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        {hint && <p className="hint">{hint}</p>}
        <p className="rating-form-target">
          Bewertung für <strong>{targetLabel}</strong>
        </p>
        <Field label="Sterne">
          <StarRatingInput value={score} onChange={onScoreChange} disabled={isSubmitting} />
        </Field>
        <Field label="Kommentar (optional)">
          <textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Wie war die Ausleihe?"
            rows={4}
            disabled={isSubmitting}
          />
        </Field>
        <div className="row report-form-actions">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isSubmitting}>
            Später
          </button>
          <button
            type="button"
            className="btn"
            onClick={onSubmit}
            disabled={isSubmitting || score < 1}
          >
            {isSubmitting ? "Wird gespeichert…" : "Bewertung speichern"}
          </button>
        </div>
      </section>
    </div>
  );
}
