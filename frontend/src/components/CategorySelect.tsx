import { TOOL_CATEGORIES } from "../utils/categories";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
}

export function CategorySelect({ value, onChange, label, hint }: CategorySelectProps) {
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
        className="select-field"
      >
        <option value="">-- Kategorie wählen --</option>
        {TOOL_CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.icon} {cat.label}
          </option>
        ))}
      </select>
    </div>
  );
}
