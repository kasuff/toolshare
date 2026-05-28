import { useMemo, useState } from "react";
import { TOOL_CATEGORIES } from "../utils/categories";

export type WorkshopToolDraftItem = {
  name: string;
  category: string;
};

interface WorkshopToolsInputProps {
  items: WorkshopToolDraftItem[];
  onChange: (items: WorkshopToolDraftItem[]) => void;
  label: string;
  hint?: string;
}

export function WorkshopToolsInput({ items, onChange, label, hint }: WorkshopToolsInputProps) {
  const [toolName, setToolName] = useState("");
  const [category, setCategory] = useState(TOOL_CATEGORIES[0]?.value ?? "sonstiges");

  const categoriesByValue = useMemo(
    () => new Map(TOOL_CATEGORIES.map((entry) => [entry.value, entry.label] as const)),
    []
  );

  const addItem = () => {
    const normalizedName = toolName.trim();
    if (!normalizedName) {
      return;
    }
    onChange([...items, { name: normalizedName, category }]);
    setToolName("");
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="workshop-tools-builder">
      <label>
        <strong>{label}</strong>
      </label>
      {hint && <p className="hint">{hint}</p>}

      <div className="workshop-tools-input-row">
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {TOOL_CATEGORIES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
        <input
          value={toolName}
          onChange={(event) => setToolName(event.target.value)}
          placeholder="Werkzeugname (z.B. Bosch Akkuschrauber)"
        />
        <button type="button" className="btn secondary" onClick={addItem}>
          Werkzeug hinzufügen
        </button>
      </div>

      {items.length > 0 ? (
        <ul className="meta-list workshop-tools-list">
          {items.map((item, index) => (
            <li key={`${item.category}-${item.name}-${index}`} className="workshop-tools-item">
              <span>
                <strong>{item.name}</strong> · {categoriesByValue.get(item.category) ?? item.category}
              </span>
              <button type="button" className="btn ghost danger" onClick={() => removeItem(index)}>
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Noch keine Werkzeuge in der Ausstattung.</p>
      )}
    </div>
  );
}
