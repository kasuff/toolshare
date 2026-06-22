import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import { EMPTY_ADDRESS, isAddressComplete, toAddressPayload } from "../utils/address";
import { Surface } from "../components/ui";
import { SystemRulesInfo } from "../components/SystemRulesInfo";
import { ImageUpload } from "../components/ImageUpload";
import { CategorySelect } from "../components/CategorySelect";
import { useToast } from "../hooks/useToast";
import {  api  } from "@toolshare/shared";
import {  DEFAULT_PLACEHOLDER_IMAGE  } from "@toolshare/shared";
import type {  User  } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";

type ToolFormField = "name" | "description" | "category" | "pickupLocation";

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function NewToolPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ToolFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pickupAddress, setPickupAddress] = useState({ ...EMPTY_ADDRESS });
  const [pickupLocationNote, setPickupLocationNote] = useState("");
  const isPickupAddressComplete = isAddressComplete(pickupAddress);
  const formErrors = {
    name: name.trim() ? null : "Bitte gib einen Namen für das Werkzeug ein.",
    description:
      description.trim().length >= 5
        ? null
        : "Bitte gib eine Beschreibung mit mindestens 5 Zeichen ein.",
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
        <h1>Werkzeug einstellen</h1>
        <Surface title="Login erforderlich" subtitle="Zum Erstellen von Angeboten musst du eingeloggt sein">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (Object.values(formErrors).some((error) => error !== null)) {
      return;
    }

    setIsLoading(true);
    try {
      const validatedAddress = toAddressPayload(pickupAddress);
      const validation = await api.validateAddress(validatedAddress);
      if (!validation.isValid) {
        pushToast("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.", "error");
        return;
      }
      const normalizedPickupLocation = validation.normalizedAddress?.trim() || validatedAddress;

      await api.createTool(
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
      
      // Reset form
      setName("");
      setDescription("");
      setCategory("");
      setUploadedImage(null);
      setPickupAddress({ ...EMPTY_ADDRESS });
      setPickupLocationNote("");
      setTouchedFields({});
      setSubmitAttempted(false);
      
      pushToast("Werkzeug erfolgreich eingestellt!", "success");
      navigate("/tools");
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Werkzeug konnte nicht angelegt werden.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="new-tool-page">
      <h1>Werkzeug einstellen</h1>

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
            aria-describedby={`new-tool-name-hint${showFieldError("name") ? " new-tool-name-error" : ""}`}
          />
          <small id="new-tool-name-hint">Kurz und konkret, z.B. Akku-Bohrmaschine DeWalt 18V</small>
          {showFieldError("name") && <p id="new-tool-name-error" className="field-error" role="alert">{formErrors.name}</p>}
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
            placeholder="z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, 1x Ladegerät. Besonderheiten: sehr leise, eingebaute LED"
            maxLength={1000}
            minLength={5}
            rows={5}
            className={showFieldError("description") ? "input-invalid" : undefined}
            aria-invalid={showFieldError("description")}
            aria-describedby={`new-tool-description-hint${showFieldError("description") ? " new-tool-description-error" : ""}`}
          />
          <small id="new-tool-description-hint">Zustand, Lieferumfang, besondere Hinweise. Schreib alles auf, was potenzielle Nutzer wissen sollten!</small>
          {showFieldError("description") && <p id="new-tool-description-error" className="field-error" role="alert">{formErrors.description}</p>}
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

        <div
          className="tool-form-field new-tool-address-section"
          role="group"
          aria-labelledby="new-tool-address-label"
          aria-describedby="new-tool-address-hint"
        >
          <span id="new-tool-address-label">Abholort *</span>
          <small id="new-tool-address-hint">Gib die vollständige Adresse an, an der das Werkzeug abgeholt werden kann.</small>

          <AddressInput
            value={pickupAddress}
            onChange={setPickupAddress}
            required
            hasError={showFieldError("pickupLocation")}
            describedBy="new-tool-address-hint"
            errorMessageId="new-tool-location-error"
            onBlur={() => markFieldTouched("pickupLocation")}
          />

          {showFieldError("pickupLocation") && <p id="new-tool-location-error" className="field-error" role="alert">{formErrors.pickupLocation}</p>}
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
            aria-describedby="new-tool-pickup-note-hint"
          />
          <small id="new-tool-pickup-note-hint">Optionaler Hinweis, der die Übergabe vor Ort erleichtert.</small>
        </label>

        <div className="new-tool-actions">
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Wird gespeichert..." : "Werkzeug einstellen"}
          </button>
          <Link to="/tools" className="btn btn-outline">
            Abbrechen
          </Link>
        </div>

        <SystemRulesInfo token={token} />
      </form>
    </section>
  );
}
