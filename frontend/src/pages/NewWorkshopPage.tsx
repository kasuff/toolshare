import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { WorkshopEquipmentSelect } from "../components/WorkshopEquipmentSelect";
import { WorkshopPhotoUpload } from "../components/WorkshopPhotoUpload";
import { WorkshopToolsInput, type WorkshopToolDraftItem } from "../components/WorkshopToolsInput";
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

type WorkshopFormField = "name" | "description" | "location" | "photos" | "slots";

const EMPTY_SLOT: SlotDraft = {
  startIso: "",
  endIso: "",
  blockedByOwner: false
};

export function NewWorkshopPage({ token }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<WorkshopFormField, boolean>>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [extras, setExtras] = useState<string[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<WorkshopToolDraftItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [slot, setSlot] = useState<SlotDraft>(EMPTY_SLOT);
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

  const formErrors: Record<WorkshopFormField, string | null> = {
    name: name.trim() ? null : "Bitte gib einen Namen für die Werkstatt ein.",
    description:
      description.trim().length >= 5
        ? null
        : "Bitte gib eine Beschreibung mit mindestens 5 Zeichen ein.",
    location: location.trim() ? null : "Bitte gib eine Adresse oder ein Gebiet an.",
    photos: photos.length > 0 ? null : "Bitte lade mindestens ein Foto hoch.",
    slots: slots.length > 0 ? null : "Bitte füge mindestens ein Zeitfenster hinzu."
  };

  const showFieldError = (field: WorkshopFormField) =>
    Boolean(formErrors[field]) && (submitAttempted || touchedFields[field]);

  const markFieldTouched = (field: WorkshopFormField) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const addSlot = () => {
    if (!slot.startIso || !slot.endIso) {
      pushToast("Bitte gib Start und Ende für das Zeitfenster an.", "error");
      return;
    }
    if (new Date(slot.startIso) >= new Date(slot.endIso)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return;
    }

    setSlots((current) => [...current, slot]);
    setSlot(EMPTY_SLOT);
    setTouchedFields((current) => ({ ...current, slots: true }));
  };

  const removeSlot = (index: number) => {
    setSlots((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);

    const firstError = Object.values(formErrors).find((error) => error !== null);
    if (firstError) {
      pushToast(firstError, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createWorkshop(
        {
          name: name.trim(),
          description: description.trim(),
          location: location.trim(),
          maxCapacity,
          extras,
          equipmentItems,
          imageUrls: photos,
          slots
        },
        token
      );

      setName("");
      setDescription("");
      setLocation("");
      setMaxCapacity(2);
      setExtras([]);
      setEquipmentItems([]);
      setPhotos([]);
      setSlot(EMPTY_SLOT);
      setSlots([]);
      setTouchedFields({});
      setSubmitAttempted(false);
      pushToast("Werkstatt erfolgreich eingestellt!", "success");
      navigate("/workshops");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht angelegt werden.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="new-workshop-page">
      <h1>Werkstatt einstellen</h1>

      <Surface title="Neue Werkstatt" subtitle="Teile deinen Raum und seine Ausstattung mit der Community">
        <form className="new-workshop-form" onSubmit={onSubmit} noValidate>
          <p className="required-note">Pflichtfelder werden mit einem * markiert.</p>

          <WorkshopPhotoUpload
            photos={photos}
            onPhotosChange={(nextPhotos) => {
              setPhotos(nextPhotos);
              markFieldTouched("photos");
            }}
            label="Werkstattfotos *"
            hint="Lade bis zu drei Fotos deiner Werkstatt hoch (JPG, PNG, max. 5 MB pro Foto)."
            maxPhotos={3}
          />
          {showFieldError("photos") && <p className="field-error">{formErrors.photos}</p>}

          <Field label="Name *" hint="Kurz und konkret, z. B. geräumige Garagen-Werkstatt">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => markFieldTouched("name")}
              placeholder="Name"
              maxLength={100}
              className={showFieldError("name") ? "input-invalid" : undefined}
              aria-invalid={showFieldError("name")}
            />
            {showFieldError("name") && <p className="field-error">{formErrors.name}</p>}
          </Field>

          <Field
            label="Beschreibung *"
            hint="Beschreibe Zustand, Nutzungsmöglichkeiten und Besonderheiten deiner Werkstatt."
          >
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => markFieldTouched("description")}
              placeholder="z. B. helle Werkstatt mit großer Arbeitsfläche und umfangreicher Holzbearbeitungsausstattung"
              maxLength={1000}
              minLength={5}
              rows={5}
              className={showFieldError("description") ? "input-invalid" : undefined}
              aria-invalid={showFieldError("description")}
            />
            {showFieldError("description") && <p className="field-error">{formErrors.description}</p>}
            <p className="character-count">{description.length}/1000 Zeichen</p>
          </Field>

          <WorkshopToolsInput
            items={equipmentItems}
            onChange={setEquipmentItems}
            label="Ausstattung"
            hint="Füge die Werkzeuge hinzu, die in deiner Werkstatt vorhanden sind."
          />

          <WorkshopEquipmentSelect
            selected={extras}
            onChange={setExtras}
            label="Extras"
            hint="Wähle optionale Zusatzmerkmale wie WLAN, Starkstrom oder einen Parkplatz."
          />

          <Field label="Adresse *" hint="Gib die Adresse oder das Gebiet an, in dem sich die Werkstatt befindet.">
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              onBlur={() => markFieldTouched("location")}
              placeholder="Adresse oder Gebiet"
              maxLength={200}
              className={showFieldError("location") ? "input-invalid" : undefined}
              aria-invalid={showFieldError("location")}
            />
            {showFieldError("location") && <p className="field-error">{formErrors.location}</p>}
          </Field>

          <div className="field workshop-capacity-field">
            <label htmlFor="capacity-input">
              <strong>Maximale Personenzahl *</strong>
            </label>
            <p className="hint">Wie viele Personen können gleichzeitig komfortabel in der Werkstatt arbeiten?</p>
            <div className="capacity-input">
              <button
                type="button"
                onClick={() => setMaxCapacity((current) => Math.max(1, current - 1))}
                className="capacity-button"
                aria-label="Personenzahl verringern"
              >
                <span className="material-symbols-outlined" aria-hidden="true">remove</span>
              </button>
              <input
                id="capacity-input"
                type="number"
                min={1}
                value={maxCapacity}
                onChange={(event) => setMaxCapacity(Math.max(1, Number(event.target.value) || 1))}
                className="capacity-display"
                aria-label="Maximale Personenzahl"
              />
              <button
                type="button"
                onClick={() => setMaxCapacity((current) => current + 1)}
                className="capacity-button"
                aria-label="Personenzahl erhöhen"
              >
                <span className="material-symbols-outlined" aria-hidden="true">add</span>
              </button>
            </div>
          </div>

          <section className="workshop-availability-section" aria-labelledby="workshop-availability-title">
            <div className="workshop-form-section-heading">
              <h2 id="workshop-availability-title">Verfügbarkeit und Zeitfenster</h2>
              <p>Lege mindestens einen buchbaren Zeitraum fest oder markiere einen Zeitraum als blockiert.</p>
            </div>

            <div className="workshop-slot-builder">
              <Field label="Startzeit">
                <input
                  type="datetime-local"
                  value={slot.startIso}
                  onChange={(event) => setSlot((current) => ({ ...current, startIso: event.target.value }))}
                />
              </Field>
              <Field label="Endzeit">
                <input
                  type="datetime-local"
                  value={slot.endIso}
                  onChange={(event) => setSlot((current) => ({ ...current, endIso: event.target.value }))}
                />
              </Field>
              <label className="workshop-block-toggle">
                <input
                  type="checkbox"
                  checked={slot.blockedByOwner}
                  onChange={(event) =>
                    setSlot((current) => ({ ...current, blockedByOwner: event.target.checked }))
                  }
                />
                <span>
                  <strong>Zeitraum blockieren</strong>
                  <small>Für Wartung oder private Nutzung sperren</small>
                </span>
              </label>
              <button type="button" className="btn secondary workshop-add-slot" onClick={addSlot}>
                <span className="material-symbols-outlined" aria-hidden="true">add</span>
                Zeitfenster hinzufügen
              </button>
            </div>

            <div className={`time-slots-list ${showFieldError("slots") ? "input-invalid" : ""}`}>
              {slots.length > 0 ? (
                <ul className="meta-list workshop-created-slots">
                  {slots.map((currentSlot, index) => (
                    <li key={`${currentSlot.startIso}-${currentSlot.endIso}-${index}`} className="slot-item">
                      <div className="workshop-slot-copy">
                        <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                        <span>
                          <strong>{new Date(currentSlot.startIso).toLocaleString("de-DE")}</strong>
                          {" bis "}
                          <strong>{new Date(currentSlot.endIso).toLocaleString("de-DE")}</strong>
                          {currentSlot.blockedByOwner && <span className="slot-badge">Blockiert</span>}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="btn ghost danger workshop-remove-slot"
                        aria-label={`Zeitfenster ${index + 1} entfernen`}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                        Entfernen
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="workshop-empty-slots">Noch kein Zeitfenster hinzugefügt.</p>
              )}
            </div>
            {showFieldError("slots") && <p className="field-error">{formErrors.slots}</p>}
          </section>

          <div className="workshop-form-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Wird eingestellt..." : "Werkstatt einstellen"}
            </button>
            <Link to="/workshops" className="btn secondary">
              Abbrechen
            </Link>
          </div>
        </form>
      </Surface>
    </section>
  );
}
