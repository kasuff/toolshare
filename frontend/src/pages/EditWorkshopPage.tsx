import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AddressInput,
  EMPTY_ADDRESS,
  isAddressComplete,
  parseAddress,
  toAddressPayload,
  type AddressFormFields
} from "../components/AddressInput";
import { Field, Surface } from "../components/ui";
import { WorkshopEquipmentSelect } from "../components/WorkshopEquipmentSelect";
import { WorkshopPhotoUpload } from "../components/WorkshopPhotoUpload";
import { WorkshopToolsInput, type WorkshopToolDraftItem } from "../components/WorkshopToolsInput";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User, WorkshopSlot } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function EditWorkshopPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [workshopAddress, setWorkshopAddress] = useState({ ...EMPTY_ADDRESS });
  const [originalWorkshopAddress, setOriginalWorkshopAddress] = useState<AddressFormFields | null>(null);
  const [originalLocation, setOriginalLocation] = useState("");
  const [addressSearchValue, setAddressSearchValue] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [extras, setExtras] = useState<string[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<WorkshopToolDraftItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("Werkstatt");
  const [slots, setSlots] = useState<WorkshopSlot[]>([]);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotBlocked, setSlotBlocked] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token || !id) {
        setLoading(false);
        return;
      }

      try {
        const detail = await api.getWorkshopById(id, token);
        if (currentUser && detail.workshop.ownerId !== currentUser.id) {
          pushToast("Diese Werkstatt kann nur vom Anbieter bearbeitet werden.", "error");
          navigate("/workshops");
          return;
        }

        setName(detail.workshop.name);
        setAddressSearchValue(detail.workshop.location);
        setOriginalLocation(detail.workshop.location);
        const addressValidation = await api.validateAddress(detail.workshop.location);
        const parsedWorkshopAddress = addressValidation.normalizedParts
            ? {
                street: addressValidation.normalizedParts.street,
                houseNumber: addressValidation.normalizedParts.houseNumber,
                postalCode: addressValidation.normalizedParts.postalCode,
                city: addressValidation.normalizedParts.city,
                country: addressValidation.normalizedParts.country || "Deutschland"
              }
            : parseAddress(detail.workshop.location);
        setWorkshopAddress(parsedWorkshopAddress);
        setOriginalWorkshopAddress(parsedWorkshopAddress);
        setMaxCapacity(detail.workshop.maxCapacity);
        setExtras(detail.workshop.extras);
        setEquipmentItems(
          detail.workshop.equipmentItems.map((item) => ({
            name: item.name,
            category: item.category
          }))
        );
        setPhotos(detail.workshop.imageUrls);
        setDescription(detail.workshop.description);
        setSlots(detail.slots);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht geladen werden.", "error");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [token, id, currentUser, navigate, pushToast]);

  if (!token) {
    return (
      <section className="stack">
        <h1>Werkstatt bearbeiten</h1>
        <Surface title="Login erforderlich" subtitle="Zum Bearbeiten einer Werkstatt musst du eingeloggt sein">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="stack">
        <h1>Werkstatt bearbeiten</h1>
        <Surface title="Lädt...">
          <p>Werkstattdaten werden geladen.</p>
        </Surface>
      </section>
    );
  }

  if (!id) {
    return (
      <section className="stack">
        <h1>Werkstatt bearbeiten</h1>
        <Surface title="Werkstatt nicht gefunden">
          <p>Die angeforderte Werkstatt konnte nicht geöffnet werden.</p>
          <div className="row">
            <Link to="/workshops" className="btn secondary">
              Zurück zu Werkstätten
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const addressWasChanged =
      !originalWorkshopAddress ||
      Object.keys(workshopAddress).some(
        (key) =>
          workshopAddress[key as keyof AddressFormFields] !==
          originalWorkshopAddress[key as keyof AddressFormFields]
      );
    const hasValidLocation =
      isAddressComplete(workshopAddress) ||
      (!addressWasChanged && originalLocation.trim().length >= 5);

    if (!name.trim()) {
      return;
    }
    if (description.trim().length < 5) {
      return;
    }
    if (!hasValidLocation) {
      return;
    }
    if (maxCapacity < 1) {
      pushToast("Die maximale Personenzahl muss mindestens 1 sein.", "error");
      return;
    }
    if (photos.length === 0) {
      return;
    }
    if (slots.length === 0) {
      return;
    }

    setSaving(true);
    try {
      const location = addressWasChanged
        ? toAddressPayload(workshopAddress)
        : originalLocation;
      const validation = addressWasChanged
        ? await api.validateAddress(location)
        : { isValid: true, normalizedAddress: originalLocation };
      if (!validation.isValid) {
        pushToast("Adresse konnte nicht verifiziert werden. Bitte wählen Sie eine vorgeschlagene Adresse.", "error");
        return;
      }

      await api.updateWorkshop(
        id,
        {
          name,
          description,
          location: validation.normalizedAddress?.trim() || location,
          maxCapacity,
          extras,
          equipmentItems,
          imageUrls: photos
        },
        token
      );

      pushToast("Werkstatt aktualisiert.", "success");
      navigate(`/workshops/${id}?manage=1`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht aktualisiert werden.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addSlot = async () => {
    if (!id || !slotStart || !slotEnd) {
      return;
    }
    if (new Date(slotStart) >= new Date(slotEnd)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return;
    }
    try {
      const created = await api.createWorkshopTimeslot(
        id,
        { startIso: slotStart, endIso: slotEnd, blockedByOwner: slotBlocked },
        token
      );
      setSlots((current) => [...current, created]);
      setSlotStart("");
      setSlotEnd("");
      setSlotBlocked(false);
      pushToast("Zeitfenster hinzugefügt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht gespeichert werden.", "error");
    }
  };

  const toggleSlot = async (slot: WorkshopSlot) => {
    if (!id) return;
    try {
      const updated = await api.updateWorkshopTimeslot(
        id,
        slot.id,
        { blockedByOwner: !slot.blockedByOwner },
        token
      );
      setSlots((current) => current.map((entry) => (entry.id === slot.id ? updated : entry)));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht aktualisiert werden.", "error");
    }
  };

  const removeSlot = async (slotId: string) => {
    if (!id) return;
    try {
      await api.deleteWorkshopTimeslot(id, slotId, token);
      setSlots((current) => current.filter((entry) => entry.id !== slotId));
      pushToast("Zeitfenster entfernt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht entfernt werden.", "error");
    }
  };

  return (
    <section className="new-tool-page new-workshop-page">
      <h1>Werkstatt bearbeiten</h1>
      <p className="subtitle">Aktualisiere Name, Standort, Ausstattung, Extras und Fotos deiner Werkstatt.</p>
        <form className="new-tool-form new-workshop-form" onSubmit={(event) => void onSubmit(event)} noValidate>
          <p className="required-note">Pflichtfelder werden mit einem * markiert!</p>
          <WorkshopPhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
            label="Werkstatt Fotos *"
            hint="Du kannst die Fotos austauschen oder ergänzen."
            maxPhotos={3}
          />
          <Field label="Werkstattname *">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required />
          </Field>

          <Field label="Beschreibung *">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              maxLength={1000}
              required
            />
          </Field>

          <Field label="Adresse *">
            <AddressInput
              value={workshopAddress}
              onChange={setWorkshopAddress}
              initialSearchValue={addressSearchValue}
              required
            />
          </Field>

          <div className="field">
            <label htmlFor="edit-workshop-capacity">
              <strong>Maximale Personenzahl *</strong>
            </label>
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
                id="edit-workshop-capacity"
                type="number"
                min={1}
                value={maxCapacity}
                onChange={(event) => setMaxCapacity(Math.max(1, Number(event.target.value)))}
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

          <WorkshopToolsInput
            items={equipmentItems}
            onChange={setEquipmentItems}
            label="Ausstattung"
            hint="Verwalte die Werkzeuge, die in deiner Werkstatt verfügbar sind."
          />

          <WorkshopEquipmentSelect
            selected={extras}
            onChange={setExtras}
            label="Extras"
            hint="Optionale Zusatzmerkmale wie WLAN, Starkstrom oder Parkplatz."
          />

          <section className="workshop-availability-section" aria-labelledby="edit-workshop-slots-title">
            <div className="workshop-form-section-heading">
              <span className="workshop-section-kicker">Buchungsplanung</span>
              <h2 id="edit-workshop-slots-title">Verfügbare Zeitfenster *</h2>
              <p>Verwalte verfügbare Zeiten und Blockierungen direkt zusammen mit dem Angebot.</p>
            </div>
            <div className="workshop-slot-builder">
              <Field label="Start">
                <input type="datetime-local" value={slotStart} onChange={(event) => setSlotStart(event.target.value)} />
              </Field>
              <Field label="Ende">
                <input type="datetime-local" value={slotEnd} onChange={(event) => setSlotEnd(event.target.value)} />
              </Field>
            </div>
            <div className="workshop-slot-editor-actions">
              <label className="workshop-block-toggle">
                <input type="checkbox" checked={slotBlocked} onChange={(event) => setSlotBlocked(event.target.checked)} />
                <span><strong>Zeitraum blockieren</strong><small>Für Wartung oder Eigenbedarf</small></span>
              </label>
              <button type="button" className="btn btn-outline" onClick={() => void addSlot()}>
                Zeitfenster hinzufügen
              </button>
            </div>
            <ul className="meta-list workshop-created-slots">
              {slots.map((slot) => (
                <li key={slot.id} className="slot-item">
                  <div>
                    <strong>{new Date(slot.startIso).toLocaleString("de-DE")}</strong>
                    {" bis "}
                    <strong>{new Date(slot.endIso).toLocaleString("de-DE")}</strong>
                    {slot.blockedByOwner && <span className="slot-badge">Blockiert</span>}
                  </div>
                  <div className="row slot-actions">
                    <button type="button" className="btn secondary" onClick={() => void toggleSlot(slot)}>
                      {slot.blockedByOwner ? "Freigeben" : "Blockieren"}
                    </button>
                    <button type="button" className="btn ghost danger" onClick={() => void removeSlot(slot.id)}>
                      Entfernen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="new-tool-actions workshop-form-actions">
            <Link to={`/workshops/${id}?manage=1`} className="btn btn-outline">
              Abbrechen
            </Link>
            <button type="submit" disabled={saving}>
              {saving ? "Speichert..." : "Änderungen speichern"}
            </button>
          </div>
        </form>
    </section>
  );
}
