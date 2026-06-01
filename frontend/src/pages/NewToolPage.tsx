import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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

type ToolFormField = "name" | "description" | "category";

export function NewToolPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [pickupAddress, setPickupAddress] = useState(currentUser?.address ?? "");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ToolFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [owner, setOwner] = useState<User | null>(currentUser || null);

  const formErrors = {
    name: name.trim() ? null : "Bitte gib einen Namen für das Werkzeug ein.",
    description:
      description.trim().length >= 5
        ? null
        : "Bitte gib eine Beschreibung mit mindestens 5 Zeichen ein.",
    category: category.trim() ? null : "Bitte wähle eine Kategorie aus."
  };

  const showFieldError = (field: ToolFormField) =>
    Boolean(formErrors[field]) && (submitAttempted || touchedFields[field]);

  const markFieldTouched = (field: ToolFormField) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  useEffect(() => {
    if (!currentUser && token && !owner) {
      api.getCurrentUser(token)
        .then((user) => {
          setOwner(user);
          setPickupAddress((current) => current || user.address || "");
        })
        .catch((err) => {
          pushToast("Fehler beim Laden der Benutzerdaten.", "error");
          console.error(err);
        });
    }
  }, [token, currentUser, owner, pushToast]);

  useEffect(() => {
    setPickupAddress((current) => current || currentUser?.address || "");
  }, [currentUser?.address]);

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
      pushToast("Bitte fülle alle Pflichtfelder aus.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await api.createTool(
        {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          imageUrl: uploadedImage || DEFAULT_PLACEHOLDER_IMAGE
        },
        token
      );

      setName("");
      setDescription("");
      setCategory("");
      setUploadedImage(null);
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

      <form className="new-tool-form" onSubmit={onSubmit}>
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
            onChange={(e) => setName(e.target.value)}
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
            onChange={(e) => setDescription(e.target.value)}
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

        <label className="tool-form-field">
          <span>Abholort *</span>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            placeholder="Adresse (mind. 5 Zeichen)"
            minLength={5}
          />
          <small>Gebe die Adresse, an der das Werkzeug abgeholt werden kann, an.</small>
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
