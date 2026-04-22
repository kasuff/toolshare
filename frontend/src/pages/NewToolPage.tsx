import { useState, type FormEvent } from "react";
import { api } from "../services/mockApi";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
};

export function NewToolPage({ currentUser }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("https://picsum.photos/seed/newtool/600/300");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !description || !category || !imageUrl) {
      alert("Bitte alle Felder ausfüllen.");
      return;
    }
    api.createTool({
      ownerId: currentUser.id,
      name,
      description,
      category,
      imageUrl,
    });
    setName("");
    setDescription("");
    setCategory("");
    alert("Werkzeug angelegt.");
  };

  return (
    <section>
      <h1>Werkzeug einstellen</h1>
      <form className="panel form" onSubmit={onSubmit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschreibung" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategorie" />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Bild-URL" />
        <button type="submit">Speichern</button>
      </form>
    </section>
  );
}
