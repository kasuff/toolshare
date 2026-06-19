import {  TOOL_CATEGORIES  } from "@toolshare/shared";

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
  return (
    <div className="category-select">
      <label htmlFor="category-select">
        <strong>{label}</strong>
      </label>
      {hint && <p className="hint">{hint}</p>}

      <select
        id="category-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`select-field ${hasError ? "input-invalid" : ""}`.trim()}
        aria-invalid={hasError}
      >
        <option value="">Kategorie wählen</option>
        {TOOL_CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.icon} {cat.label}
          </option>
        ))}
      </select>
      {hasError && errorMessage && <p className="field-error">{errorMessage}</p>}
    </div>
  );
}
