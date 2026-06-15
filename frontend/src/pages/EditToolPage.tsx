import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import { EMPTY_ADDRESS, isAddressComplete, parseAddress, toAddressPayload } from "../utils/address";
import { Surface } from "../components/ui";
import { ImageUpload } from "../components/ImageUpload";
import { CategorySelect } from "../components/CategorySelect";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../utils/categories";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

type ToolFormField = "name" | "description" | "category" | "pickupLocation";

export function EditToolPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ToolFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pickupAddress, setPickupAddress] = useState({ ...EMPTY_ADDRESS });
  const [addressSearchValue, setAddressSearchValue] = useState("");
  const [pickupLocationNote, setPickupLocationNote] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!token || !id) {
        setLoading(false);
        return;
      }

      try {
        const tool = await api.getToolById(id, token);
        if (currentUser && tool.ownerId !== currentUser.id) {
          pushToast("Dieses Werkzeug kann nur vom Anbieter bearbeitet werden.", "error");
          navigate(`/tools/${id}`);
          return;
        }

        setName(tool.name);
        setDescription(tool.description);
        setCategory(tool.category);
        setUploadedImage(tool.imageUrl && tool.imageUrl !== DEFAULT_PLACEHOLDER_IMAGE ? tool.imageUrl : null);
        setPickupLocationNote(tool.pickupLocationNote ?? "");

        const location = tool.pickupLocation ?? "";
        setAddressSearchValue(location);
        if (location) {
          const validation = await api.validateAddress(location);
          setPickupAddress(
            validation.normalizedParts
              ? {
                  street: validation.normalizedParts.street,
                  houseNumber: validation.normalizedParts.houseNumber,
                  postalCode: validation.normalizedParts.postalCode,
                  city: validation.normalizedParts.city,
                  country: validation.normalizedParts.country || "Deutschland"
                }
              : parseAddress(location)
          );
        }
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht geladen werden.", "error");
        navigate("/tools");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [token, id, currentUser, navigate, pushToast]);

  const isPickupAddressComplete = isAddressComplete(pickupAddress);
  const formErrors = {
    name: name.trim() ? null : "Bitte gib einen Namen für das Werkzeug ein.",
    description:
      description.trim().length >= 5 ? null : "Bitte gib eine Beschreibung mit mindestens 5 Zeichen ein.",
    category: category.trim() ? null : "Bitte wähle eine Kategorie aus.",
    pickupLocation: isPickupAddressComplete ? null : "Bitte gib einen vollständigen Abholort an."
  };

  const showFieldError = (field: ToolFormField) =>
    Boolean(formErrors[field]) && (submitAttempted || touchedFields[field]);

  const markFieldTouched = (field: ToolFormField) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  if (!token) {
    return (
      <section className="stack">
        <h1>Werkzeug bearbeiten</h1>
        <Surface title="Login erforderlich" subtitle="Zum Bearbeiten eines Werkzeugs musst du eingeloggt sein">
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
        <h1>Werkzeug bearbeiten</h1>
        <Surface title="Lädt...">
          <p>Werkzeugdaten werden geladen.</p>
        </Surface>
      </section>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (Object.values(formErrors).some((error) => error !== null)) {
      pushToast(formErrors.pickupLocation ?? "Bitte fülle alle Pflichtfelder aus.", "error");
      return;
    }
    if (!id) return;

    setIsSaving(true);
    try {
      const validatedAddress = toAddressPayload(pickupAddress);
      const validation = await api.validateAddress(validatedAddress);
      if (!validation.isValid) {
        pushToast("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.", "error");
        return;
      }
      const normalizedPickupLocation = validation.normalizedAddress?.trim() || validatedAddress;

      await api.updateTool(
        id,
        {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          imageUrl: uploadedImage || DEFAULT_PLACEHOLDER_IMAGE,
          pickupLocation: normalizedPickupLocation,
          pickupLocationNote: pickupLocationNote.trim() || undefined
        },
        token
      );

      pushToast("Werkzeug aktualisiert.", "success");
      navigate(`/tools/${id}`);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht aktualisiert werden.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="new-tool-page">
      <h1>Werkzeug bearbeiten</h1>

      <form className="new-tool-form" onSubmit={onSubmit} noValidate>
        <p className="required-note">Pflichtfelder werden mit einem * markiert!</p>

        <ImageUpload
          onImageSelect={setUploadedImage}
          currentImage={uploadedImage ?? undefined}
          placeholderImage={DEFAULT_PLACEHOLDER_IMAGE}
          label="Werkzeug Fotos"
          hint="Lade gute Fotos von deinem Werkzeug hoch (JPG, PNG, max. 5MB). Ohne Upload wird ein Standard-Bild für deine Kategorie verwendet."
        />

        <label className="tool-form-field">
          <span>Name *</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => markFieldTouched("name")}
            placeholder="z.B. Akku-Bohrmaschine"
            maxLength={100}
            className={showFieldError("name") ? "input-invalid" : undefined}
            aria-invalid={showFieldError("name")}
          />
          <small>Kurz und konkret, z.B. Akku-Bohrmaschine DeWalt 18V</small>
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
            placeholder="z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, 1x Ladegerät."
            maxLength={1000}
            minLength={5}
            rows={5}
            className={showFieldError("description") ? "input-invalid" : undefined}
            aria-invalid={showFieldError("description")}
          />
          <small>Zustand, Lieferumfang, besondere Hinweise. Schreib alles auf, was potenzielle Nutzer wissen sollten!</small>
          {showFieldError("description") && <p className="field-error">{formErrors.description}</p>}
        </label>

        <CategorySelect
          value={category}
          onChange={setCategory}
          onBlur={() => markFieldTouched("category")}
          label="Kategorie *"
          hint="Wähle eine passende Kategorie, damit andere dein Werkzeug leicht finden können."
          hasError={showFieldError("category")}
          errorMessage={formErrors.category}
        />

        <div className="tool-form-field new-tool-address-section">
          <span>Abholort *</span>
          <small>Gib die vollständige Adresse an, an der das Werkzeug abgeholt werden kann.</small>

          <AddressInput
            value={pickupAddress}
            onChange={setPickupAddress}
            initialSearchValue={addressSearchValue}
            required
            hasError={showFieldError("pickupLocation")}
            onBlur={() => markFieldTouched("pickupLocation")}
          />

          {showFieldError("pickupLocation") && <p className="field-error">{formErrors.pickupLocation}</p>}
        </div>

        <label className="tool-form-field">
          <span className="field-label-row">
            <span>Hinweis zur Abholung</span>
            <span className="char-count">{pickupLocationNote.length}/300 Zeichen</span>
          </span>
          <textarea
            value={pickupLocationNote}
            onChange={(event) => setPickupLocationNote(event.target.value)}
            maxLength={300}
            rows={3}
            placeholder="z.B. Klingeln bei Thomas, 4. Stock, Hinterhof links"
          />
          <small>Optionaler Hinweis, der die Übergabe vor Ort erleichtert.</small>
        </label>

        <div className="new-tool-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Wird gespeichert..." : "Änderungen speichern"}
          </button>
          <Link to={`/tools/${id}`} className="btn btn-outline">
            Abbrechen
          </Link>
        </div>
      </form>
    </section>
  );
}
