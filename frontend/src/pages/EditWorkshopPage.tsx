import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import { EMPTY_ADDRESS, isAddressComplete, parseAddress, toAddressPayload } from "../utils/address";
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

export function EditWorkshopPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [workshopAddress, setWorkshopAddress] = useState({ ...EMPTY_ADDRESS });
  const [addressSearchValue, setAddressSearchValue] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [extras, setExtras] = useState<string[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<WorkshopToolDraftItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("Werkstatt");

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
        const addressValidation = await api.validateAddress(detail.workshop.location);
        setWorkshopAddress(
          addressValidation.normalizedParts
            ? {
                street: addressValidation.normalizedParts.street,
                houseNumber: addressValidation.normalizedParts.houseNumber,
                postalCode: addressValidation.normalizedParts.postalCode,
                city: addressValidation.normalizedParts.city,
                country: addressValidation.normalizedParts.country || "Deutschland"
              }
            : parseAddress(detail.workshop.location)
        );
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

    if (!name.trim()) {
      pushToast("Bitte geben Sie einen Werkstatt-Namen ein.", "error");
      return;
    }
    if (!isAddressComplete(workshopAddress)) {
      pushToast("Bitte geben Sie eine vollständige Werkstattadresse an.", "error");
      return;
    }
    if (maxCapacity < 1) {
      pushToast("Die maximale Personenzahl muss mindestens 1 sein.", "error");
      return;
    }
    if (photos.length === 0) {
      pushToast("Bitte laden Sie mindestens ein Foto hoch.", "error");
      return;
    }

    setSaving(true);
    try {
      const location = toAddressPayload(workshopAddress);
      const validation = await api.validateAddress(location);
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
      navigate("/workshops");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkstatt konnte nicht aktualisiert werden.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="stack">
      <h1>Werkstatt bearbeiten</h1>
      <p className="subtitle">Aktualisiere Name, Standort, Ausstattung, Extras und Fotos deiner Werkstatt.</p>
      <Surface title="Stammdaten">
        <form className="stack" onSubmit={(event) => void onSubmit(event)}>
          <Field label="Werkstattname">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required />
          </Field>

          <Field label="Adresse">
            <AddressInput
              value={workshopAddress}
              onChange={setWorkshopAddress}
              initialSearchValue={addressSearchValue}
              required
            />
          </Field>

          <div className="field">
            <label htmlFor="edit-workshop-capacity">
              <strong>Maximale Personenzahl</strong>
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

          <WorkshopPhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
            label="Fotos deiner Werkstatt"
            hint="Du kannst die Fotos austauschen oder ergänzen."
            maxPhotos={3}
          />

          <div className="row">
            <Link to="/workshops" className="btn secondary">
              Abbrechen
            </Link>
            <button type="submit" disabled={saving}>
              {saving ? "Speichert..." : "Änderungen speichern"}
            </button>
          </div>
        </form>
      </Surface>
    </section>
  );
}
