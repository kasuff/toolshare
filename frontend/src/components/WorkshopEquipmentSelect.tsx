import { WORKSHOP_EQUIPMENT } from "./workshop-equipment";

interface WorkshopEquipmentSelectProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  hint?: string;
}

export function WorkshopEquipmentSelect({ selected, onChange, label, hint }: WorkshopEquipmentSelectProps) {
  const toggleEquipment = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="equipment-select">
      <label>
        <strong>{label}</strong>
      </label>
      {hint && <p className="hint">{hint}</p>}

      <div className="equipment-grid">
        {WORKSHOP_EQUIPMENT.map((equipment) => (
          <label key={equipment.value} className={`equipment-option ${selected.includes(equipment.value) ? "selected" : ""}`}>
            <input
              type="checkbox"
              checked={selected.includes(equipment.value)}
              onChange={() => toggleEquipment(equipment.value)}
              className="equipment-checkbox"
            />
            <div className="equipment-content">
              <span className="material-symbols-outlined equipment-icon">{equipment.icon}</span>
              <span className="equipment-label">{equipment.label}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
