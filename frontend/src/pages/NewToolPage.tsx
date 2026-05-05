import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { ImageUpload } from "../components/ImageUpload";
import { CategorySelect } from "../components/CategorySelect";
import { OwnerContactCard } from "../components/OwnerContactCard";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import { getPlaceholderImageForCategory } from "../utils/categories";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function NewToolPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

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
    
    if (!name.trim()) {
      pushToast("Bitte gib einen Namen für das Werkzeug ein.", "error");
      return;
    }
    
    if (!description.trim()) {
      pushToast("Bitte schreib eine Beschreibung für das Werkzeug.", "error");
      return;
    }
    
    if (!category) {
      pushToast("Bitte wähle eine Kategorie.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await api.createTool(
        {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          imageUrl: uploadedImage || getPlaceholderImageForCategory(category)
        },
        token
      );
      
      // Reset form
      setName("");
      setDescription("");
      setCategory("");
      setUploadedImage(null);
      
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
            currentImage={uploadedImage || undefined}
            label="Werkzeug Foto"
            hint="Lade ein gutes Foto deines Werkzeugs hoch (JPG, PNG, max. 5MB). Ohne Upload wird ein Standard-Bild für deine Kategorie verwendet."
          />

          {/* Name */}
          <Field label="Name" hint="Kurz und konkret, z.B. Akku-Bohrmaschine DeWalt 18V">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Akku-Bohrmaschine 18V"
              maxLength={100}
            />
          </Field>

          {/* Beschreibung */}
          <Field label="Beschreibung" hint="Zustand, Lieferumfang, besondere Hinweise. Schreib alles auf, was potenzielle Nutzer wissen sollten!">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B.: Zustand: wie neu, selten benutzt. Lieferumfang: 1x Bohrmaschine, 2x Akkus, Ladegerät. Besonderheiten: sehr leise, eingebaute LED"
              maxLength={1000}
              rows={5}
              style={{ minHeight: "150px" }}
            />
            <p style={{ fontSize: "0.85em", color: "#666" }}>
              {description.length}/1000 Zeichen
            </p>
          </Field>

          {/* Kategorie */}
          <CategorySelect
            value={category}
            onChange={setCategory}
            label="Kategorie"
            hint="Wähle eine passende Kategorie, damit andere dein Werkzeug leicht finden können."
          />

          {/* Pflichtfelder Hinweis */}
          <div className="info-box" style={{ backgroundColor: "#f5f5f5", padding: "12px", borderRadius: "6px", borderLeft: "4px solid #2196F3" }}>
            <p style={{ margin: "0", fontSize: "0.9em" }}>
              <strong>Alle Felder sind erforderlich:</strong> Name, Beschreibung und Kategorie. Ein Foto ist optional.
            </p>
          </div>

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
