import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

type SlotDraft = {
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
};

export function NewWorkshopPage({ token }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [slot, setSlot] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: false });
  const [slots, setSlots] = useState<SlotDraft[]>([]);

  if (!token) {
    return (
      <section className="stack">
        <h1>Werkstatt einstellen</h1>
        <Surface title="Login erforderlich" subtitle="Zum Anlegen einer Werkstatt musst du eingeloggt sein">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  const addSlot = () => {
    if (!slot.startIso || !slot.endIso) {
      pushToast("Bitte Start und Ende für den Slot angeben.", "error");
      return;
    }
    setSlots((prev) => [...prev, slot]);
    setSlot({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !description || !location || slots.length === 0) {
      pushToast("Bitte alle Pflichtfelder inkl. mindestens einem Slot ausfüllen.", "error");
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
      pushToast("Werkstatt angelegt.", "success");
      navigate("/workshops");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht angelegt werden.", "error");
    }
  };

  return (
    <section className="stack">
      <h1>Werkstatt einstellen</h1>
      <Surface title="Neue Werkstatt" subtitle="Erstelle den Standort und hinterlege verfügbare Slots">
        <form className="stack" onSubmit={onSubmit}>
          <div className="grid grid-2">
            <Field label="Werkstattname" hint="Eindeutiger Name für die Suche">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            </Field>
            <Field label="Ort" hint="Stadtteil oder genaue Adresse">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adresse oder Gebiet" />
            </Field>
          </div>
          <Field label="Beschreibung" hint="Ausstattung, Regeln, Zugang">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ausstattung, Regeln, Hinweise" />
          </Field>
          <Field label="Maximale Personenanzahl" hint="Wie viele Personen gleichzeitig arbeiten können">
            <input type="number" min={1} value={maxCapacity} onChange={(e) => setMaxCapacity(Number(e.target.value))} />
          </Field>

          <Surface title="Zeitfenster / Blockierungen">
            <div className="grid grid-3">
              <Field label="Startzeit">
                <input type="datetime-local" value={slot.startIso} onChange={(e) => setSlot({ ...slot, startIso: e.target.value })} />
              </Field>
              <Field label="Endzeit">
                <input type="datetime-local" value={slot.endIso} onChange={(e) => setSlot({ ...slot, endIso: e.target.value })} />
              </Field>
              <label className="field">
                <span>Slot blockieren</span>
                <input
                  type="checkbox"
                  checked={slot.blockedByOwner}
                  onChange={(e) => setSlot({ ...slot, blockedByOwner: e.target.checked })}
                />
              </label>
            </div>
            <div className="row">
              <button type="button" className="ghost btn secondary" onClick={addSlot}>
                Slot hinzufügen
              </button>
            </div>
            <ul className="meta-list">
              {slots.map((s, i) => (
                <li key={`${s.startIso}-${i}`}>
                  {new Date(s.startIso).toLocaleString()} - {new Date(s.endIso).toLocaleString()} {s.blockedByOwner ? "(blockiert)" : ""}
                </li>
              ))}
            </ul>
          </Surface>

          <div className="row">
            <button type="submit">Werkstatt speichern</button>
          </div>
        </form>
      </Surface>
    </section>
  );
}
