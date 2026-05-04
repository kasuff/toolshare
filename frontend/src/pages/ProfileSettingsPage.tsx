import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  onSave: (input: { name?: string; address?: string; avatarUrl?: string | null }) => Promise<User>;
};

export function ProfileSettingsPage({ currentUser, onSave }: Props) {
  const { pushToast } = useToast();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [address, setAddress] = useState(currentUser?.address ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(currentUser?.name ?? "");
    setAddress(currentUser?.address ?? "");
    setAvatarUrl(currentUser?.avatarUrl ?? "");
  }, [currentUser?.id, currentUser?.name, currentUser?.address, currentUser?.avatarUrl]);

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
    const nextAvatarUrl = avatarUrl.trim();
    if (nextAvatarUrl && !/^https?:\/\/.+/i.test(nextAvatarUrl)) {
      pushToast("Profilbild muss als gültige URL angegeben werden (http/https).", "error");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name: nextName, address: nextAddress, avatarUrl: nextAvatarUrl || null });
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
        <div className="profile-head">
          <div className="profile-image-wrap">
            {avatarUrl.trim() ? (
              <img src={avatarUrl.trim()} alt="Profilbild" className="profile-image" />
            ) : (
              <span className="profile-image-fallback" aria-hidden="true">
                {currentUser.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>
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
          <Field label="Profilbild URL" hint="Füge ein Bild per Link hinzu (z. B. von GitHub oder Gravatar)">
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
              type="url"
            />
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
