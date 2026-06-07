import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Surface } from "../components/ui";
import { ImageUpload } from "../components/ImageUpload";
import { CategorySelect } from "../components/CategorySelect";
import { useToast } from "../hooks/useToast";
import { api, type AddressSuggestion } from "../services/api";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../utils/categories";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

type ToolFormField = "name" | "description" | "category" | "pickupLocation";

type AddressFormFields = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

function toAddressPayload(fields: AddressFormFields) {
  return `${fields.street} ${fields.houseNumber}, ${fields.postalCode} ${fields.city}, ${fields.country}`
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toAddressPreview(fields: AddressFormFields) {
  return toAddressPayload(fields);
}

export function NewToolPage({ token }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ToolFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [pickupAddress, setPickupAddress] = useState<AddressFormFields>({
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    country: "Deutschland"
  });
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isAddressSearchFocused, setIsAddressSearchFocused] = useState(false);
  const [pickupLocationNote, setPickupLocationNote] = useState("");
  const pickupLocationPreview = toAddressPreview(pickupAddress);
  const isPickupAddressComplete = Boolean(
    pickupAddress.street.trim() &&
      pickupAddress.houseNumber.trim() &&
      pickupAddress.postalCode.trim() &&
      pickupAddress.city.trim()
  );
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

  useEffect(() => {
    if (addressSearch.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void api.suggestAddresses(addressSearch).then((suggestions) => {
        setAddressSuggestions(suggestions);
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [addressSearch]);

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
      pushToast(formErrors.pickupLocation ?? "Bitte fülle alle Pflichtfelder aus.", "error");
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
      setAddressSearch("");
      setPickupAddress({
        street: "",
        houseNumber: "",
        postalCode: "",
        city: "",
        country: "Deutschland"
      });
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
            placeholder="z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, 1x Ladegerät. Besonderheiten: sehr leise, eingebaute LED"
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

          <div className="address-autocomplete">
            <input
              value={addressSearch}
              onChange={(event) => setAddressSearch(event.target.value)}
              onFocus={() => setIsAddressSearchFocused(true)}
              onBlur={() => {
                markFieldTouched("pickupLocation");
                window.setTimeout(() => setIsAddressSearchFocused(false), 120);
              }}
              placeholder="Adresse suchen (optional für Autofill)"
              autoComplete="street-address"
              className={showFieldError("pickupLocation") ? "input-invalid" : undefined}
              aria-invalid={showFieldError("pickupLocation")}
            />
            {isAddressSearchFocused && addressSearch.trim().length >= 3 && (
              <div className="address-dropdown" role="listbox" aria-label="Adressvorschläge">
                <p className="address-dropdown-head">Vorschläge - klicken zum Übernehmen</p>
                {addressSuggestions.length > 0 ? (
                  <ul className="address-suggestion-list">
                    {addressSuggestions.map((suggestion) => (
                      <li key={suggestion.label}>
                        <button
                          type="button"
                          className="address-suggestion-item"
                          onMouseDown={() => {
                            setPickupAddress({
                              street: suggestion.street,
                              houseNumber: suggestion.houseNumber,
                              postalCode: suggestion.postalCode,
                              city: suggestion.city,
                              country: suggestion.country || "Deutschland"
                            });
                            setAddressSearch(suggestion.label);
                          }}
                        >
                          <span className="address-suggestion-title">{suggestion.label}</span>
                          <span className="address-suggestion-meta">
                            {suggestion.postalCode} {suggestion.city}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="address-suggestion-empty">Keine Vorschläge gefunden.</p>
                )}
              </div>
            )}
          </div>
          <small>Mindestens 3 Zeichen eingeben, um Adressvorschläge zu sehen.</small>

          <div className="address-grid new-tool-address-grid">
            <label className="address-field address-field-street form-label">
              <span>Straße *</span>
              <input
                value={pickupAddress.street}
                onChange={(event) => setPickupAddress((prev) => ({ ...prev, street: event.target.value }))}
                onBlur={() => markFieldTouched("pickupLocation")}
                placeholder="Straße"
                autoComplete="address-line1"
              />
            </label>
            <label className="address-field form-label">
              <span>Hausnummer *</span>
              <input
                value={pickupAddress.houseNumber}
                onChange={(event) => setPickupAddress((prev) => ({ ...prev, houseNumber: event.target.value }))}
                onBlur={() => markFieldTouched("pickupLocation")}
                placeholder="Hausnummer"
                autoComplete="address-line2"
              />
            </label>
            <label className="address-field form-label">
              <span>PLZ *</span>
              <input
                value={pickupAddress.postalCode}
                onChange={(event) => setPickupAddress((prev) => ({ ...prev, postalCode: event.target.value }))}
                onBlur={() => markFieldTouched("pickupLocation")}
                placeholder="PLZ"
                autoComplete="postal-code"
              />
            </label>
            <label className="address-field address-field-city form-label">
              <span>Ort *</span>
              <input
                value={pickupAddress.city}
                onChange={(event) => setPickupAddress((prev) => ({ ...prev, city: event.target.value }))}
                onBlur={() => markFieldTouched("pickupLocation")}
                placeholder="Ort"
                autoComplete="address-level2"
              />
            </label>
            <label className="address-field address-field-country form-label">
              <span>Land</span>
              <input
                value={pickupAddress.country}
                onChange={(event) => setPickupAddress((prev) => ({ ...prev, country: event.target.value }))}
                onBlur={() => markFieldTouched("pickupLocation")}
                placeholder="Land"
                autoComplete="country-name"
              />
            </label>
          </div>

          {pickupLocationPreview.length > 0 && (
            <p className="address-preview" aria-live="polite">
              {pickupLocationPreview}
            </p>
          )}
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
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Wird gespeichert..." : "Werkzeug einstellen"}
          </button>
          <Link to="/tools" className="btn btn-outline">
            Abbrechen
          </Link>
        </div>
      </form>
    </section>
  );
}
