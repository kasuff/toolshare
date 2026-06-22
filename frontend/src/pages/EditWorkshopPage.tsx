import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddressInput } from "../components/AddressInput";
import {
  EMPTY_ADDRESS,
  isAddressComplete,
  parseAddress,
  toAddressPayload,
  type AddressFormFields
} from "../utils/address";
import { Field, Surface } from "../components/ui";
import { WorkshopEquipmentSelect } from "../components/WorkshopEquipmentSelect";
import { WorkshopPhotoUpload } from "../components/WorkshopPhotoUpload";
import { WorkshopToolsInput, type WorkshopToolDraftItem } from "../components/WorkshopToolsInput";
import { useToast } from "../hooks/useToast";
import { api } from "@toolshare/shared";
import type { User, WorkshopSlot } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function EditWorkshopPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["workshop", id, "edit", token],
    queryFn: async () => {
      if (!id || !token || !currentUser) throw new Error("Missing auth/id");
      const detail = await api.getWorkshopById(id, token);
      if (detail.workshop.ownerId !== currentUser.id) {
        throw new Error("Diese Werkstatt kann nur vom Anbieter bearbeitet werden.");
      }
      return detail;
    },
    enabled: !!id && !!token && !!currentUser,
    retry: false
  });

  useEffect(() => {
    if (data) {
      const { workshop, slots: loadedSlots } = data;
      setName(workshop.name);
      setAddressSearchValue(workshop.location);
      setOriginalLocation(workshop.location);
      
      const doValidate = async () => {
        try {
          const addressValidation = await api.validateAddress(workshop.location);
          const parsedWorkshopAddress = addressValidation.normalizedParts
            ? {
                street: addressValidation.normalizedParts.street,
                houseNumber: addressValidation.normalizedParts.houseNumber,
                postalCode: addressValidation.normalizedParts.postalCode,
                city: addressValidation.normalizedParts.city,
                country: addressValidation.normalizedParts.country || "Deutschland"
              }
            : parseAddress(workshop.location);
          setWorkshopAddress(parsedWorkshopAddress);
          setOriginalWorkshopAddress(parsedWorkshopAddress);
        } catch {
          const parsed = parseAddress(workshop.location);
          setWorkshopAddress(parsed);
          setOriginalWorkshopAddress(parsed);
        }
      };
      void doValidate();
      
      setMaxCapacity(workshop.maxCapacity);
      setExtras(workshop.extras);
      setEquipmentItems(
        workshop.equipmentItems.map((item) => ({
          name: item.name,
          category: item.category
        }))
      );
      setPhotos(workshop.imageUrls);
      setDescription(workshop.description);
      setSlots(loadedSlots);
    }
  }, [data]);

  useEffect(() => {
    if (isError) {
      pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht geladen werden.", "error");
      navigate("/workshops");
    }
  }, [isError, error, navigate, pushToast]);

  const { mutate: updateWorkshopMut, isPending: saving } = useMutation({
    mutationFn: async ({ location, addressWasChanged }: { location: string; addressWasChanged: boolean }) => {
      if (!id || !token) throw new Error("Missing context");
      const validation = addressWasChanged
        ? await api.validateAddress(location)
        : { isValid: true, normalizedAddress: originalLocation };
      if (!validation.isValid) {
        throw new Error("Adresse konnte nicht verifiziert werden. Bitte wählen Sie eine vorgeschlagene Adresse.");
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop", id] });
      pushToast("Werkstatt aktualisiert.", "success");
      navigate(`/workshops/${id}?manage=1`);
    },
    onError: (e) => {
      pushToast(e instanceof Error ? e.message : "Werkstatt konnte nicht aktualisiert werden.", "error");
    }
  });

  const onSubmit = (event: FormEvent) => {
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

    if (!name.trim() || description.trim().length < 5 || !hasValidLocation) {
      return;
    }
    if (maxCapacity < 1) {
      pushToast("Die maximale Personenzahl muss mindestens 1 sein.", "error");
      return;
    }
    if (photos.length === 0 || slots.length === 0) {
      return;
    }

    const location = addressWasChanged
      ? toAddressPayload(workshopAddress)
      : originalLocation;

    updateWorkshopMut({ location, addressWasChanged });
  };

  const { mutate: addSlotMut } = useMutation({
    mutationFn: async () => {
      if (!id || !token) throw new Error("Missing context");
      return api.createWorkshopTimeslot(
        id,
        { startIso: slotStart, endIso: slotEnd, blockedByOwner: slotBlocked },
        token
      );
    },
    onSuccess: (created) => {
      setSlots((current) => [...current, created]);
      setSlotStart("");
      setSlotEnd("");
      setSlotBlocked(false);
      queryClient.invalidateQueries({ queryKey: ["workshop", id] });
      pushToast("Zeitfenster hinzugefügt.", "success");
    },
    onError: (e) => {
      pushToast(e instanceof Error ? e.message : "Zeitfenster konnte nicht gespeichert werden.", "error");
    }
  });

  const addSlot = () => {
    if (!id || !slotStart || !slotEnd) return;
    if (new Date(slotStart) >= new Date(slotEnd)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return;
    }
    addSlotMut();
  };

  const { mutate: toggleSlotMut } = useMutation({
    mutationFn: async (slot: WorkshopSlot) => {
      if (!id || !token) throw new Error("Missing context");
      return api.updateWorkshopTimeslot(
        id,
        slot.id,
        { blockedByOwner: !slot.blockedByOwner },
        token
      );
    },
    onSuccess: (updated) => {
      setSlots((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      queryClient.invalidateQueries({ queryKey: ["workshop", id] });
    },
    onError: (e) => {
      pushToast(e instanceof Error ? e.message : "Zeitfenster konnte nicht aktualisiert werden.", "error");
    }
  });

  const { mutate: removeSlotMut } = useMutation({
    mutationFn: async (slotId: string) => {
      if (!id || !token) throw new Error("Missing context");
      await api.deleteWorkshopTimeslot(id, slotId, token);
      return slotId;
    },
    onSuccess: (slotId) => {
      setSlots((current) => current.filter((entry) => entry.id !== slotId));
      queryClient.invalidateQueries({ queryKey: ["workshop", id] });
      pushToast("Zeitfenster entfernt.", "success");
    },
    onError: (e) => {
      pushToast(e instanceof Error ? e.message : "Zeitfenster konnte nicht entfernt werden.", "error");
    }
  });

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

  if (isLoading || !data) {
    return (
      <section className="stack">
        <h1>Werkstatt bearbeiten</h1>
        <Surface title="Lädt...">
          <p>Werkstattdaten werden geladen.</p>
        </Surface>
      </section>
    );
  }

  return (
    <section className="new-tool-page new-workshop-page">
      <h1>Werkstatt bearbeiten</h1>
      <p className="subtitle">Aktualisiere Name, Standort, Ausstattung, Extras und Fotos deiner Werkstatt.</p>
        <form className="new-tool-form new-workshop-form" onSubmit={onSubmit} noValidate>
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
                <input aria-label="Zeitraum blockieren" type="checkbox" checked={slotBlocked} onChange={(event) => setSlotBlocked(event.target.checked)} />
                <span><strong>Zeitraum blockieren</strong><small>Für Wartung oder Eigenbedarf</small></span>
              </label>
              <button type="button" className="btn btn-outline" onClick={addSlot}>
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
                    <button type="button" className="btn secondary" onClick={() => toggleSlotMut(slot)}>
                      {slot.blockedByOwner ? "Freigeben" : "Blockieren"}
                    </button>
                    <button type="button" className="btn ghost danger" onClick={() => removeSlotMut(slot.id)}>
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
