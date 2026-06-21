import { useId } from "react";
import { TOOL_CATEGORIES } from "@toolshare/shared";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  onBlur?: () => void;
  hasError?: boolean;
  errorMessage?: string | null;
}

export function CategorySelect({ value, onChange, label, hint, onBlur, hasError = false, errorMessage }: CategorySelectProps) {
  const selectId = useId();
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [hint ? hintId : null, hasError && errorMessage ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="category-select">
      <label htmlFor={selectId}>
        <strong>{label}</strong>
      </label>
      {hint && <p id={hintId} className="hint">{hint}</p>}

      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`select-field ${hasError ? "input-invalid" : ""}`.trim()}
        aria-invalid={hasError}
        aria-describedby={describedBy}
      >
        <option value="">Kategorie wählen</option>
        {TOOL_CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.icon} {cat.label}
          </option>
        ))}
      </select>
      {hasError && errorMessage && <p id={errorId} className="field-error" role="alert">{errorMessage}</p>}
    </div>
  );
}
