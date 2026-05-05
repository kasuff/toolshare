import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api, type AddressSuggestion } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  onSave: (input: { name?: string; address?: string }) => Promise<User>;
};

type AddressFormFields = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

function parseAddress(raw?: string): AddressFormFields {
  if (!raw) {
    return { street: "", houseNumber: "", postalCode: "", city: "", country: "Deutschland" };
  }

  const [streetPart = "", cityPart = "", countryPart = "Deutschland"] = raw.split(",").map((part) => part.trim());
  const streetTokens = streetPart.split(" ");
  const houseNumber = streetTokens.length > 1 ? streetTokens.pop() ?? "" : "";
  const street = streetTokens.join(" ");

  const cityTokens = cityPart.split(" ");
  const postalCode = cityTokens.length > 1 ? cityTokens.shift() ?? "" : "";
  const city = cityTokens.join(" ");

  return { street, houseNumber, postalCode, city, country: countryPart || "Deutschland" };
}

function toAddressPayload(fields: AddressFormFields) {
  return `${fields.street} ${fields.houseNumber}, ${fields.postalCode} ${fields.city}, ${fields.country}`.trim();
}

export function ProfileSettingsPage({ currentUser, onSave }: Props) {
  const { pushToast } = useToast();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [addressSearch, setAddressSearch] = useState("");
  const [address, setAddress] = useState<AddressFormFields>(() => parseAddress(currentUser?.address));
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isAddressSearchFocused, setIsAddressSearchFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(currentUser?.name ?? "");
    setAddress(parseAddress(currentUser?.address));
    setAddressSearch(currentUser?.address ?? "");
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
      setAddressSearch(validation.normalizedParts.label);
    });
  }, [currentUser?.address]);

  useEffect(() => {
    if (addressSearch.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void api.suggestAddresses(addressSearch).then((suggestions) => {
        setAddressSuggestions(suggestions);
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [addressSearch]);

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
    if (!address.street.trim() || !address.houseNumber.trim() || !address.postalCode.trim() || !address.city.trim()) {
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
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dein Name" autoComplete="name" />
          </Field>
          <Field label="Adresse">
            <div className="address-autocomplete">
              <input
                value={addressSearch}
                onChange={(event) => setAddressSearch(event.target.value)}
                onFocus={() => setIsAddressSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setIsAddressSearchFocused(false), 120)}
                placeholder="Adresse suchen (optional für Autofill)"
                autoComplete="street-address"
              />
              {isAddressSearchFocused && addressSearch.trim().length >= 3 && (
                <div className="address-dropdown" role="listbox" aria-label="Adressvorschläge">
                  <p className="address-dropdown-head">Vorschläge - klicken zum Übernehmen</p>
                  {addressSuggestions.length > 0 ? (
                    <ul className="address-suggestion-list">
                      {addressSuggestions.map((suggestion) => (
                        <li key={suggestion.label}>
                          <button
                            type="button"
                            className="address-suggestion-item"
                            onMouseDown={() => {
                              setAddress({
                                street: suggestion.street,
                                houseNumber: suggestion.houseNumber,
                                postalCode: suggestion.postalCode,
                                city: suggestion.city,
                                country: suggestion.country || "Deutschland"
                              });
                              setAddressSearch(suggestion.label);
                            }}
                          >
                            <span className="address-suggestion-title">{suggestion.label}</span>
                            <span className="address-suggestion-meta">
                              {suggestion.postalCode} {suggestion.city}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="address-suggestion-empty">Keine Vorschläge gefunden.</p>
                  )}
                </div>
              )}
            </div>
            <p className="hint">Mindestens 3 Zeichen eingeben, um Adressvorschläge zu sehen.</p>
            <div className="address-grid">
              <input
                value={address.street}
                onChange={(event) => setAddress((prev) => ({ ...prev, street: event.target.value }))}
                placeholder="Straße"
                autoComplete="address-line1"
              />
              <input
                value={address.houseNumber}
                onChange={(event) => setAddress((prev) => ({ ...prev, houseNumber: event.target.value }))}
                placeholder="Hausnummer"
                autoComplete="address-line2"
              />
              <input
                value={address.postalCode}
                onChange={(event) => setAddress((prev) => ({ ...prev, postalCode: event.target.value }))}
                placeholder="PLZ"
                autoComplete="postal-code"
              />
              <input
                value={address.city}
                onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Ort"
                autoComplete="address-level2"
              />
              <input
                value={address.country}
                onChange={(event) => setAddress((prev) => ({ ...prev, country: event.target.value }))}
                placeholder="Land"
                autoComplete="country-name"
              />
            </div>
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
