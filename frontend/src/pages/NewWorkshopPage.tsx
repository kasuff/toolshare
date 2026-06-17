import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import { DateInput } from "../components/DateInput";
import { EMPTY_ADDRESS, isAddressComplete, toAddressPayload } from "../utils/address";
import { Surface } from "../components/ui";
import { WorkshopEquipmentSelect } from "../components/WorkshopEquipmentSelect";
import { WorkshopPhotoUpload } from "../components/WorkshopPhotoUpload";
import { WorkshopToolsInput, type WorkshopToolDraftItem } from "../components/WorkshopToolsInput";
import { SystemRulesInfo } from "../components/SystemRulesInfo";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import { pluralize } from "../utils/pluralize";
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

type SlotEditorDraft = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  blockedByOwner: boolean;
};

type WorkshopFormField = "name" | "description" | "location" | "photos" | "slots";

const EMPTY_SLOT: SlotEditorDraft = {
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
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
  const [workshopAddress, setWorkshopAddress] = useState({ ...EMPTY_ADDRESS });
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [extras, setExtras] = useState<string[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<WorkshopToolDraftItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [slot, setSlot] = useState<SlotEditorDraft>(EMPTY_SLOT);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const location = toAddressPayload(workshopAddress);
  const isWorkshopAddressComplete = isAddressComplete(workshopAddress);

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
    location: isWorkshopAddressComplete ? null : "Bitte gib eine vollständige Werkstattadresse an.",
    photos: photos.length > 0 ? null : "Bitte lade mindestens ein Foto hoch.",
    // Zeitfenster sind optional: Eine Werkstatt ist standardmäßig verfügbar; hier können
    // optional bereits Zeiträume blockiert werden.
    slots: null
  };

  const showFieldError = (field: WorkshopFormField) =>
    Boolean(formErrors[field]) && (submitAttempted || touchedFields[field]);

  const markFieldTouched = (field: WorkshopFormField) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const addSlot = () => {
    if (!slot.startDate || !slot.startTime || !slot.endDate || !slot.endTime) {
      return;
    }
    const startIso = `${slot.startDate}T${slot.startTime}`;
    const endIso = `${slot.endDate}T${slot.endTime}`;
    if (new Date(startIso) >= new Date(endIso)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return;
    }

    setSlots((current) => [...current, { startIso, endIso, blockedByOwner: true }]);
    setSlot(EMPTY_SLOT);
    setTouchedFields((current) => ({ ...current, slots: true }));
  };

  const removeSlot = (index: number) => {
    setSlots((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);

    if (Object.values(formErrors).some((error) => error !== null)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const validation = await api.validateAddress(location);
      if (!validation.isValid) {
        pushToast("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.", "error");
        return;
      }
      const normalizedLocation = validation.normalizedAddress?.trim() || location;

      await api.createWorkshop(
        {
          name: name.trim(),
          description: description.trim(),
          location: normalizedLocation,
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
      setWorkshopAddress({ ...EMPTY_ADDRESS });
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
    <section className="new-tool-page new-workshop-page">
      <h1>Werkstatt einstellen</h1>

      <form className="new-tool-form new-workshop-form" onSubmit={onSubmit} noValidate>
        <p className="required-note">Pflichtfelder werden mit einem * markiert!</p>

        <WorkshopPhotoUpload
          photos={photos}
          onPhotosChange={(nextPhotos) => {
            setPhotos(nextPhotos);
            markFieldTouched("photos");
          }}
          label="Werkstatt Fotos *"
          hint="Lade bis zu drei gute Fotos deiner Werkstatt hoch (JPG, PNG, WebP, max. 5 MB pro Foto)."
          maxPhotos={3}
        />
        {showFieldError("photos") && <p className="field-error">{formErrors.photos}</p>}

        <label className="tool-form-field">
          <span>Name *</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => markFieldTouched("name")}
            placeholder="z.B. Garagen-Werkstatt"
            maxLength={100}
            className={showFieldError("name") ? "input-invalid" : undefined}
            aria-invalid={showFieldError("name")}
          />
          <small>Kurz und konkret, z.B. geräumige Garagen-Werkstatt.</small>
          {showFieldError("name") && <p className="field-error">{formErrors.name}</p>}
        </label>

        <label className="tool-form-field">
          <span className="field-label-row">
            <span>Beschreibung *</span>
            <span className="char-count">{description.length}/1000 Zeichen</span>
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => markFieldTouched("description")}
            placeholder="z.B. helle Werkstatt mit großer Arbeitsfläche und umfangreicher Holzbearbeitungsausstattung"
            maxLength={1000}
            minLength={5}
            rows={5}
            className={showFieldError("description") ? "input-invalid" : undefined}
            aria-invalid={showFieldError("description")}
          />
          <small>Beschreibe Zustand, Nutzungsmöglichkeiten und Besonderheiten deiner Werkstatt.</small>
          {showFieldError("description") && <p className="field-error">{formErrors.description}</p>}
        </label>

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

        <div className="tool-form-field new-tool-address-section">
          <span>Adresse *</span>
          <small>Gib die vollständige Adresse an, an der sich die Werkstatt befindet.</small>

          <AddressInput
            value={workshopAddress}
            onChange={setWorkshopAddress}
            required
            hasError={showFieldError("location")}
            onBlur={() => markFieldTouched("location")}
          />
          {showFieldError("location") && <p className="field-error">{formErrors.location}</p>}
        </div>

        <div className="tool-form-field workshop-capacity-field">
          <span>Maximale Personenzahl *</span>
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
          <small>Wie viele Personen können gleichzeitig komfortabel in der Werkstatt arbeiten?</small>
        </div>

        <section className="workshop-availability-section" aria-labelledby="workshop-availability-title">
          <div className="workshop-form-section-heading">
            <span className="workshop-section-kicker">Buchungsplanung</span>
            <h2 id="workshop-availability-title">Zeiten blockieren (optional)</h2>
            <p>
              Deine Werkstatt ist standardmäßig immer buchbar. Optional kannst du hier schon Zeiträume blockieren, in denen
              sie nicht gebucht werden kann. Das geht auch später jederzeit über „Zeiten blockieren“.
            </p>
          </div>

          <div className="workshop-slot-editor">
            <div className="workshop-slot-editor-heading">
              <div>
                <strong>Zeitraum blockieren</strong>
                <span>Start und Ende des blockierten Zeitraums festlegen</span>
              </div>
            </div>

            <div className="workshop-slot-builder">
              <div className="workshop-slot-date-group">
                <strong>Startdaten</strong>
                <div className="booking-fields-row">
                  <label>
                    <span>Datum</span>
                    <DateInput
                      aria-label="Startdatum"
                      className="booking-input"
                      value={slot.startDate}
                      onChange={(value) => setSlot((current) => ({ ...current, startDate: value }))}
                    />
                  </label>
                  <label>
                    <span>Uhrzeit</span>
                    <input
                      aria-label="Startzeit"
                      type="time"
                      className="booking-input"
                      value={slot.startTime}
                      onChange={(event) => setSlot((current) => ({ ...current, startTime: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
              <div className="workshop-slot-date-group">
                <strong>Enddaten</strong>
                <div className="booking-fields-row">
                  <label>
                    <span>Datum</span>
                    <DateInput
                      aria-label="Enddatum"
                      className="booking-input"
                      value={slot.endDate}
                      min={slot.startDate}
                      onChange={(value) => setSlot((current) => ({ ...current, endDate: value }))}
                    />
                  </label>
                  <label>
                    <span>Uhrzeit</span>
                    <input
                      aria-label="Endzeit"
                      type="time"
                      className="booking-input"
                      value={slot.endTime}
                      onChange={(event) => setSlot((current) => ({ ...current, endTime: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="workshop-slot-editor-actions">
              <button type="button" className="btn btn-outline workshop-add-slot" onClick={addSlot}>
                <span className="material-symbols-outlined" aria-hidden="true">add</span>
                Zeitraum blockieren
              </button>
            </div>
          </div>

          <div className="workshop-slot-list-heading">
            <strong>Blockierte Zeiten</strong>
            <span>{slots.length === 0 ? "Noch keine Einträge" : pluralize(slots.length, "Eintrag", "Einträge")}</span>
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

        <div className="new-tool-actions workshop-form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Wird eingestellt..." : "Werkstatt einstellen"}
          </button>
          <Link to="/workshops" className="btn btn-outline">
            Abbrechen
          </Link>
        </div>

        <SystemRulesInfo token={token} />
      </form>
    </section>
  );
}
