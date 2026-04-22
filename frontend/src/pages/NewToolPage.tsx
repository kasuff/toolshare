import { useState, type FormEvent } from "react";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
};

export function NewToolPage({ token }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !description || !category) {
      alert("Bitte alle Felder ausfüllen.");
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
      alert("Werkzeug angelegt.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Werkzeug konnte nicht angelegt werden.");
    }
  };

  return (
    <section>
      <h1>Werkzeug einstellen</h1>
      <form className="panel form" onSubmit={onSubmit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategorie" />
        <button type="submit">Speichern</button>
      </form>
    </section>
  );
}
