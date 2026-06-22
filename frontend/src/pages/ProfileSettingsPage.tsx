import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AddressInput } from "../components/AddressInput";
import {
  isAddressComplete,
  parseAddress,
  toAddressPayload,
  type AddressFormFields
} from "../utils/address";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import {  api  } from "@toolshare/shared";
import type {  User  } from "@toolshare/shared";

import { usePageAuth } from "../hooks/usePageAuth";

export function ProfileSettingsPage({
  onSave,
  currentUser: propUser,
  token: propToken
}: {
  onSave: (input: { name?: string; address?: string }) => Promise<User>;
  currentUser?: User;
  token?: string | null;
}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const { pushToast } = useToast();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [address, setAddress] = useState<AddressFormFields>(() => parseAddress(currentUser?.address));
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const closePasswordForm = () => {
    setIsPasswordFormOpen(false);
    resetPasswordForm();
  };

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      pushToast("Bitte alle Passwortfelder ausfüllen.", "error");
      return;
    }
    if (newPassword.length < 8) {
      pushToast("Das neue Passwort muss mindestens 8 Zeichen haben.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      pushToast("Die beiden neuen Passwörter stimmen nicht überein.", "error");
      return;
    }
    if (newPassword === currentPassword) {
      pushToast("Das neue Passwort muss sich vom aktuellen unterscheiden.", "error");
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword, token);
      pushToast("Passwort wurde geändert.", "success");
      closePasswordForm();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Passwort konnte nicht geändert werden.", "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

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
      return;
    }
    if (!isAddressComplete(address)) {
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
        {!isPasswordFormOpen ? (
          <button
            type="button"
            className="btn profile-password-button"
            onClick={() => setIsPasswordFormOpen(true)}
          >
            Passwort ändern
          </button>
        ) : (
          <form className="profile-password-form" onSubmit={onChangePassword}>
            <Field label="Aktuelles Passwort">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Aktuelles Passwort"
              />
            </Field>
            <Field label="Neues Passwort">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Mindestens 8 Zeichen"
              />
            </Field>
            <Field label="Neues Passwort wiederholen">
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Neues Passwort erneut eingeben"
              />
            </Field>
            <div className="row">
              <button type="submit" className="btn" disabled={isChangingPassword}>
                {isChangingPassword ? "Speichere..." : "Passwort ändern"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={closePasswordForm}
                disabled={isChangingPassword}
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
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
