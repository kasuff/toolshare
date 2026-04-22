import { useState, type FormEvent } from "react";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
};

type SlotDraft = {
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
};

export function NewWorkshopPage({ token }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [slot, setSlot] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: false });
  const [slots, setSlots] = useState<SlotDraft[]>([]);

  const addSlot = () => {
    if (!slot.startIso || !slot.endIso) {
      alert("Bitte Start und Ende für den Slot angeben.");
      return;
    }
    setSlots((prev) => [...prev, slot]);
    setSlot({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !description || !location || slots.length === 0) {
      alert("Bitte alle Pflichtfelder inkl. mindestens einem Slot ausfüllen.");
      return;
    }

    try {
      await api.createWorkshop(
        {
          name,
          description,
          location,
          maxCapacity,
          slots: slots.map((item) => ({ startIso: item.startIso, endIso: item.endIso }))
        },
        token
      );

      setName("");
      setDescription("");
      setLocation("");
      setMaxCapacity(2);
      setSlots([]);
      alert("Werkstatt angelegt.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Werkstatt konnte nicht angelegt werden.");
    }
  };

  return (
    <section>
      <h1>Werkstatt einstellen</h1>
      <form className="panel form" onSubmit={onSubmit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Werkstattname" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ort" />
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
