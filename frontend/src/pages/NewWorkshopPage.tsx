import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { WorkshopEquipmentSelect } from "../components/WorkshopEquipmentSelect";
import { WorkshopPhotoUpload } from "../components/WorkshopPhotoUpload";
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
  const [step, setStep] = useState<"basic" | "availability">("basic");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
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

  const validateBasicStep = () => {
    if (!name.trim()) {
      pushToast("Bitte geben Sie einen Werkstatt-Namen ein.", "error");
      return false;
    }
    if (!location.trim()) {
      pushToast("Bitte geben Sie einen Ort an.", "error");
      return false;
    }
    if (photos.length === 0) {
      pushToast("Bitte laden Sie mindestens ein Foto hoch.", "error");
      return false;
    }
    if (maxCapacity < 1) {
      pushToast("Die maximale Personenzahl muss mindestens 1 sein.", "error");
      return false;
    }
    return true;
  };

  const addSlot = () => {
    if (!slot.startIso || !slot.endIso) {
      pushToast("Bitte Start und Ende für den Slot angeben.", "error");
      return;
    }
    if (new Date(slot.startIso) >= new Date(slot.endIso)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return;
    }
    setSlots((prev) => [...prev, slot]);
    setSlot({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const goToAvailabilityStep = () => {
    if (validateBasicStep()) {
      setStep("availability");
    }
  };

  const goBackToBasic = () => {
    setStep("basic");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (slots.length === 0) {
      pushToast("Bitte fügen Sie mindestens einen Zeitfenster hinzu.", "error");
      return;
    }

    try {
      const description = equipment.length > 0
        ? `Ausstattung: ${equipment.join(", ")}`
        : "Werkstatt";

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
      setLocation("");
      setMaxCapacity(2);
      setEquipment([]);
      setPhotos([]);
      setSlots([]);
      setStep("basic");
      pushToast("Werkstatt angelegt.", "success");
      navigate("/workshops");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht angelegt werden.", "error");
    }
  };

  // Basic Information Step
  if (step === "basic") {
    return (
      <section className="stack">
        <h1>Erstelle deine Werkstatt</h1>
        <p className="subtitle">Teile deinen Raum und deine Werkzeuge mit der Community. In nur wenigen Schritten bist du startklar.</p>
        <Surface title="Wie heißt deine Werkstatt?" subtitle="Wähle einen einladenden Namen, der deinen Raum beschreibt.">
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              goToAvailabilityStep();
            }}
          >
            <Field label="Werkstattname" hint="z.B. Kreativraum Berlin Neukölln">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                required
              />
            </Field>

            <Field label="Ort" hint="Stadtteil oder genaue Adresse">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Adresse oder Gebiet"
                required
              />
            </Field>

            <div className="field">
              <label htmlFor="capacity-input">
                <strong>Maximale Personenzahl</strong>
              </label>
              <p className="hint">Wie viele Personen können gleichzeitig komfortabel arbeiten?</p>
              <div className="capacity-input">
                <button
                  type="button"
                  onClick={() => setMaxCapacity(Math.max(1, maxCapacity - 1))}
                  className="capacity-button"
                  aria-label="Personenzahl verringern"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <input
                  id="capacity-input"
                  type="number"
                  min={1}
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Math.max(1, Number(e.target.value)))}
                  className="capacity-display"
                />
                <button
                  type="button"
                  onClick={() => setMaxCapacity(maxCapacity + 1)}
                  className="capacity-button"
                  aria-label="Personenzahl erhöhen"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <WorkshopEquipmentSelect
              selected={equipment}
              onChange={setEquipment}
              label="Ausstattung & Werkzeuge"
              hint="Welche Geräte und Annehmlichkeiten stellst du bereit?"
            />

            <WorkshopPhotoUpload
              photos={photos}
              onPhotosChange={setPhotos}
              label="Fotos deiner Werkstatt"
              hint="Bilder helfen Nutzer:innen, sich ein Bild von deinem Arbeitsplatz zu machen. Lade mindestens ein Foto hoch."
              maxPhotos={3}
            />

            <div className="row">
              <button type="submit">Schritt 1 von 3</button>
            </div>
          </form>
        </Surface>
      </section>
    );
  }

  // Availability & Time Slots Step
  if (step === "availability") {
    return (
      <section className="stack">
        <h1>Verfügbarkeit & Zeitfenster</h1>
        <p className="subtitle">Verwende die Buchungen und blockiere Zeiten für Wartungsarbeiten.</p>
        <Surface title="Zeitfenster hinzufügen" subtitle="Definiere deine regelmäßigen Öffnungszeiten und blockiere Zeiten bei Bedarf.">
          <form className="stack" onSubmit={onSubmit}>
            <div className="grid grid-3">
              <Field label="Startzeit">
                <input
                  type="datetime-local"
                  value={slot.startIso}
                  onChange={(e) => setSlot({ ...slot, startIso: e.target.value })}
                />
              </Field>
              <Field label="Endzeit">
                <input
                  type="datetime-local"
                  value={slot.endIso}
                  onChange={(e) => setSlot({ ...slot, endIso: e.target.value })}
                />
              </Field>
              <label className="field" style={{ paddingTop: "1.5rem" }}>
                <span>Zeitraum blockieren</span>
                <input
                  type="checkbox"
                  checked={slot.blockedByOwner}
                  onChange={(e) => setSlot({ ...slot, blockedByOwner: e.target.checked })}
                />
              </label>
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={addSlot}>
                Zeitfenster hinzufügen
              </button>
            </div>

            <div className="time-slots-list">
              {slots.length > 0 ? (
                <ul className="meta-list">
                  {slots.map((s, i) => (
                    <li key={`${s.startIso}-${i}`} className="slot-item">
                      <div>
                        <strong>{new Date(s.startIso).toLocaleString("de-DE")}</strong>
                        {" – "}
                        <strong>{new Date(s.endIso).toLocaleString("de-DE")}</strong>
                        {s.blockedByOwner && <span className="slot-badge">blockiert</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        className="btn ghost danger"
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        Entfernen
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  Noch kein Zeitfenster hinzugefügt
                </p>
              )}
            </div>

            <div className="row" style={{ gap: "0.5rem" }}>
              <button type="button" className="btn secondary" onClick={goBackToBasic}>
                Zurück
              </button>
              <button type="submit">Werkstatt veröffentlichen</button>
            </div>
          </form>
        </Surface>
      </section>
    );
  }

  return null;
}
