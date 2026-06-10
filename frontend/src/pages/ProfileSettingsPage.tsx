import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AddressInput,
  isAddressComplete,
  parseAddress,
  toAddressPayload,
  type AddressFormFields
} from "../components/AddressInput";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  onSave: (input: { name?: string; address?: string }) => Promise<User>;
};

export function ProfileSettingsPage({ currentUser, onSave }: Props) {
  const { pushToast } = useToast();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [address, setAddress] = useState<AddressFormFields>(() => parseAddress(currentUser?.address));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(currentUser?.name ?? "");
    setAddress(parseAddress(currentUser?.address));
  }, [currentUser?.id, currentUser?.name, currentUser?.address]);

  useEffect(() => {
    if (!currentUser?.address) return;

    void api.validateAddress(currentUser.address).then((validation) => {
      if (!validation.normalizedParts) return;
      setAddress({
        street: validation.normalizedParts.street,
        houseNumber: validation.normalizedParts.houseNumber,
        postalCode: validation.normalizedParts.postalCode,
        city: validation.normalizedParts.city,
        country: validation.normalizedParts.country || "Deutschland"
      });
    });
  }, [currentUser?.address]);

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
    const nextAddress = toAddressPayload(address);

    if (nextName.length < 2) {
      pushToast("Name muss mindestens 2 Zeichen haben.", "error");
      return;
    }
    if (!isAddressComplete(address)) {
      pushToast("Bitte Straße, Hausnummer, PLZ und Ort vollständig ausfüllen.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const validation = await api.validateAddress(nextAddress);
      if (!validation.isValid) {
        pushToast("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.", "error");
        return;
      }
      await onSave({ name: nextName, address: nextAddress });
      pushToast("Profil gespeichert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profile-settings-page">
      <h1>Einstellungen</h1>

      <Surface title="Kontodaten" className="profile-settings-card profile-account-card">
        <div className="profile-account-data">
          <span>E-Mail</span>
          <a href={`mailto:${currentUser.email}`}>{currentUser.email}</a>
        </div>
        <button
          type="button"
          className="btn profile-password-button"
          onClick={() => pushToast("Die Passwortänderung ist derzeit noch nicht verfügbar.", "info")}
        >
          Passwort ändern
        </button>
      </Surface>

      <Surface title="Persönliche Daten" className="profile-settings-card">
        <form className="profile-settings-form" onSubmit={onSubmit}>
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dein Name" autoComplete="name" />
          </Field>
          <Field label="Adresse">
            <AddressInput
              value={address}
              onChange={setAddress}
              initialSearchValue={currentUser.address}
              required
            />
          </Field>
          <button type="submit" className="btn profile-save-button" disabled={isSaving}>
            {isSaving ? "Speichere..." : "Änderungen speichern"}
          </button>
        </form>
      </Surface>
    </section>
  );
}
