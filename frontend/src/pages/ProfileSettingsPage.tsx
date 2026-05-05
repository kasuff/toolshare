import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  onSave: (input: { name?: string; address?: string }) => Promise<User>;
};

export function ProfileSettingsPage({ currentUser, onSave }: Props) {
  const { pushToast } = useToast();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [address, setAddress] = useState(currentUser?.address ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(currentUser?.name ?? "");
    setAddress(currentUser?.address ?? "");
  }, [currentUser?.id, currentUser?.name, currentUser?.address]);

  if (!currentUser) {
    return (
      <section className="stack">
        <h1>Profil</h1>
        <Surface title="Login erforderlich" subtitle="Dein Profil ist nur für eingeloggte Nutzer verfügbar">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    const nextAddress = address.trim();

    if (nextName.length < 2) {
      pushToast("Name muss mindestens 2 Zeichen haben.", "error");
      return;
    }
    if (nextAddress.length < 5) {
      pushToast("Adresse muss mindestens 5 Zeichen haben.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name: nextName, address: nextAddress });
      pushToast("Profil gespeichert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="stack">
      <h1>Profil-Settings</h1>
      <Surface title="Konto" subtitle="Übersicht deiner Kontodaten">
        <ul className="meta-list">
          <li>
            <strong>E-Mail:</strong> {currentUser.email}
          </li>
          <li>
            <strong>Rolle:</strong> {currentUser.role}
          </li>
          <li>
            <strong>Status:</strong> {currentUser.isSuspended ? "Gesperrt" : "Aktiv"}
          </li>
        </ul>
      </Surface>

      <Surface title="Persönliche Daten" subtitle="Passe Name und Adresse an">
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dein Name" />
          </Field>
          <Field label="Adresse">
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Deine Adresse" />
          </Field>
          <div className="row">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Speichere..." : "Änderungen speichern"}
            </button>
          </div>
        </form>
      </Surface>

    </section>
  );
}
