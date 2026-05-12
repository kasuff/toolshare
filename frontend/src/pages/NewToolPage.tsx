import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { ImageUpload } from "../components/ImageUpload";
import { CategorySelect } from "../components/CategorySelect";
import { OwnerContactCard } from "../components/OwnerContactCard";
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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ToolFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const previewImage = uploadedImage || DEFAULT_PLACEHOLDER_IMAGE;
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

  // Fallback for user data if not provided
  const [owner, setOwner] = useState<User | null>(currentUser || null);

  useEffect(() => {
    // If currentUser is not provided but token exists, fetch it
    if (!currentUser && token && !owner) {
      api.getCurrentUser(token)
        .then(setOwner)
        .catch((err) => {
          pushToast("Fehler beim Laden der Benutzerdaten.", "error");
          console.error(err);
        });
    }
  }, [token, currentUser, owner, pushToast]);

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
      
      // Reset form
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
    <section className="stack">
      <h1>Werkzeug einstellen</h1>
      
      <Surface title="Neues Werkzeug" subtitle="Teile dein Werkzeug mit der Community">
        {owner && <OwnerContactCard owner={owner} />}
        
        <form className="stack" onSubmit={onSubmit}>
          {/* Bild Upload */}
          <ImageUpload
            onImageSelect={setUploadedImage}
            currentImage={previewImage}
            placeholderImage={DEFAULT_PLACEHOLDER_IMAGE}
            label="Werkzeug Foto"
            hint="Lade ein gutes Foto deines Werkzeugs hoch (JPG, PNG, max. 5MB). Ohne Upload wird das Standard-Hammerbild verwendet."
          />

          {/* Name */}
          <Field label="Name" hint="Kurz und konkret, z.B. Akku-Bohrmaschine DeWalt 18V">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markFieldTouched("name")}
              placeholder="z.B. Akku-Bohrmaschine 18V"
              maxLength={100}
              className={showFieldError("name") ? "input-invalid" : undefined}
              aria-invalid={showFieldError("name")}
            />
            {showFieldError("name") && <p className="field-error">{formErrors.name}</p>}
          </Field>

          {/* Beschreibung */}
          <Field label="Beschreibung" hint="Zustand, Lieferumfang, besondere Hinweise. Schreib alles auf, was potenzielle Nutzer wissen sollten!">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => markFieldTouched("description")}
              placeholder="z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, Ladegerät. Besonderheiten: sehr leise, eingebaute LED"
              maxLength={1000}
              minLength={5}
              rows={5}
              style={{ minHeight: "150px" }}
              className={showFieldError("description") ? "input-invalid" : undefined}
              aria-invalid={showFieldError("description")}
            />
            {showFieldError("description") && <p className="field-error">{formErrors.description}</p>}
            <p style={{ fontSize: "0.85em", color: "#666" }}>
              {description.length}/1000 Zeichen
            </p>
          </Field>

          {/* Kategorie */}
          <CategorySelect
            value={category}
            onChange={setCategory}
            onBlur={() => markFieldTouched("category")}
            label="Kategorie"
            hint="Wähle eine passende Kategorie, damit andere dein Werkzeug leicht finden können."
            hasError={showFieldError("category")}
            errorMessage={formErrors.category}
          />

          {/* Submit Button */}
          <div className="row" style={{ gap: "12px" }}>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? "not-allowed" : "pointer" }}
            >
              {isLoading ? "Wird gespeichert..." : "✓ Werkzeug einstellen"}
            </button>
            <Link to="/tools" className="btn btn-outline">
              Abbrechen
            </Link>
          </div>
        </form>
      </Surface>
    </section>
  );
}
