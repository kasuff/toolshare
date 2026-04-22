import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function NewToolPage({ token }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

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
    if (!name || !description || !category) {
      pushToast("Bitte alle Felder ausfüllen.", "error");
      return;
    }
    try {
      await api.createTool(
        {
          name,
          description,
          category
        },
        token
      );
      setName("");
      setDescription("");
      setCategory("");
      pushToast("Werkzeug angelegt.", "success");
      navigate("/tools");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht angelegt werden.", "error");
    }
  };

  return (
    <section className="stack">
      <h1>Werkzeug einstellen</h1>
      <Surface title="Neues Werkzeug" subtitle="Lege ein Angebot für die Community an">
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Name" hint="Kurz und konkret, z.B. Akku-Bohrmaschine 18V">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Akku-Bohrmaschine" />
          </Field>
          <Field label="Beschreibung" hint="Zustand, Lieferumfang, besondere Hinweise">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Zustand, Hinweise, Lieferumfang" />
          </Field>
          <Field label="Kategorie" hint="Hilft anderen bei der Suche">
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="z.B. Elektro, Garten, Holz" />
          </Field>
          <p className="hint">Pflichtfelder: Name, Beschreibung, Kategorie.</p>
          <div className="row">
            <button type="submit">Speichern</button>
          </div>
        </form>
      </Surface>
    </section>
  );
}
