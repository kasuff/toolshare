import { useMemo, useState, type FormEvent } from "react";
import { api } from "../services/mockApi";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
};

type SlotDraft = {
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
};

export function NewWorkshopPage({ currentUser }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [imageUrlsInput, setImageUrlsInput] = useState("https://picsum.photos/seed/newworkshop/600/300");
  const [slot, setSlot] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: false });
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [toolIds, setToolIds] = useState<string[]>([]);

  const ownTools = useMemo(
    () => api.getTools().filter((t) => t.ownerId === currentUser.id),
    [currentUser.id],
  );

  const addSlot = () => {
    if (!slot.startIso || !slot.endIso) {
      alert("Bitte Start und Ende für den Slot angeben.");
      return;
    }
    setSlots((prev) => [...prev, slot]);
    setSlot({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const toggleTool = (toolId: string) => {
    setToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const imageUrls = imageUrlsInput
      .split(",")
      .map((it) => it.trim())
      .filter(Boolean);

    if (!name || !description || !location || slots.length === 0 || imageUrls.length === 0) {
      alert("Bitte alle Pflichtfelder inkl. mindestens einem Foto und einem Slot ausfüllen.");
      return;
    }

    api.createWorkshop(
      {
        ownerId: currentUser.id,
        name,
        description,
        location,
        maxCapacity,
        imageUrls,
        toolIds,
      },
      slots,
    );

    setName("");
    setDescription("");
    setLocation("");
    setMaxCapacity(2);
    setImageUrlsInput("https://picsum.photos/seed/newworkshop/600/300");
    setToolIds([]);
    setSlots([]);
    alert("Werkstatt angelegt.");
  };

  return (
    <section>
      <h1>Werkstatt einstellen</h1>
      <form className="panel form" onSubmit={onSubmit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Werkstattname" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ort" />
        <input
          value={imageUrlsInput}
          onChange={(e) => setImageUrlsInput(e.target.value)}
          placeholder="Foto-URLs (kommagetrennt)"
        />

        <label>
          Max. Personen
          <input
            type="number"
            min={1}
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(Number(e.target.value))}
          />
        </label>

        <fieldset>
          <legend>Werkstatt-Werkzeuge</legend>
          {ownTools.length === 0 && <p>Keine eigenen Werkzeuge vorhanden.</p>}
          {ownTools.map((tool) => (
            <label key={tool.id}>
              <input
                type="checkbox"
                checked={toolIds.includes(tool.id)}
                onChange={() => toggleTool(tool.id)}
              />
              {tool.name}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Zeitfenster/Blockierungen</legend>
          <div className="grid grid-3">
            <label className="field-label">
              <span>Startzeit</span>
              <input
                type="datetime-local"
                value={slot.startIso}
                onChange={(e) => setSlot({ ...slot, startIso: e.target.value })}
              />
            </label>
            <label className="field-label">
              <span>Endzeit</span>
              <input
                type="datetime-local"
                value={slot.endIso}
                onChange={(e) => setSlot({ ...slot, endIso: e.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={slot.blockedByOwner}
                onChange={(e) => setSlot({ ...slot, blockedByOwner: e.target.checked })}
              />
              Vom Anbieter blockiert
            </label>
          </div>
          <button type="button" className="ghost" onClick={addSlot}>
            Slot hinzufügen
          </button>
          <ul>
            {slots.map((s, i) => (
              <li key={`${s.startIso}-${i}`}>
                {new Date(s.startIso).toLocaleString()} - {new Date(s.endIso).toLocaleString()} {" "}
                {s.blockedByOwner ? "(blockiert)" : ""}
              </li>
            ))}
          </ul>
        </fieldset>

        <button type="submit">Werkstatt speichern</button>
      </form>
    </section>
  );
}
