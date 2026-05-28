import { FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastViewport } from "./components/ui";
import { useSession } from "./hooks/useSession";
import { ToastProvider, useToast } from "./hooks/useToast";
import { DashboardPage } from "./pages/DashboardPage";
import { ToolsPage } from "./pages/ToolsPage";
import { ToolDetailPage } from "./pages/ToolDetailPage";
import { NewToolPage } from "./pages/NewToolPage";
import { WorkshopsPage } from "./pages/WorkshopsPage";
import { NewWorkshopPage } from "./pages/NewWorkshopPage";
import { EditWorkshopPage } from "./pages/EditWorkshopPage";
import { WorkshopAvailabilityPage } from "./pages/WorkshopAvailabilityPage";
import { InboxPage } from "./pages/InboxPage";
import { AdminPage } from "./pages/AdminPage";
import { ModerationPage } from "./pages/ModerationPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { api, type AddressSuggestion } from "./services/api";

type AddressFormFields = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

function toAddressPayload(fields: AddressFormFields) {
  return `${fields.street} ${fields.houseNumber}, ${fields.postalCode} ${fields.city}, ${fields.country}`.trim();
}

function toAddressPreview(fields: AddressFormFields) {
  return toAddressPayload(fields).replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
}

function AuthScreen({
  onLogin,
  onRegister,
  error
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (input: {
    email: string;
    password: string;
    name: string;
    address: string;
  }) => Promise<void>;
  error: string | null;
}) {
  const location = useLocation();
  const redirectHint =
    typeof (location.state as { redirectHint?: unknown } | null)?.redirectHint === "string"
      ? ((location.state as { redirectHint: string }).redirectHint as string)
      : null;
  const { pushToast } = useToast();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [name, setName] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [address, setAddress] = useState<AddressFormFields>({
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    country: "Deutschland"
  });
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isAddressSearchFocused, setIsAddressSearchFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addressPreview = toAddressPreview(address);

  useEffect(() => {
    if (!isRegister || addressSearch.trim().length < 3) {
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
  }, [addressSearch, isRegister]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isRegister) {
        if (password !== repeatPassword) {
          throw new Error("Passwörter stimmen nicht überein.");
        }
        if (!address.street.trim() || !address.houseNumber.trim() || !address.postalCode.trim() || !address.city.trim()) {
          throw new Error("Bitte Straße, Hausnummer, PLZ und Ort vollständig ausfüllen.");
        }
        const payloadAddress = toAddressPayload(address);
        const validation = await api.validateAddress(payloadAddress);
        if (!validation.isValid) {
          throw new Error("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.");
        }
        await onRegister({ email, password, name, address: payloadAddress });
        pushToast("Konto erstellt und eingeloggt.", "success");
        return;
      }
      await onLogin(email, password);
      pushToast("Erfolgreich eingeloggt.", "success");
    } catch (submitError) {
      pushToast(submitError instanceof Error ? submitError.message : "Authentifizierung fehlgeschlagen.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <section className="auth-card">
        <aside className="auth-brand">
          <p className="eyebrow">Toolshare Community</p>
          <h1>Teilen, buchen, gemeinsam bauen.</h1>
          <p>
            Plattform für Werkzeuge und Werkstätten in der Nachbarschaft mit klaren Buchungsprozessen für Nutzer,
            Moderation und Admin.
          </p>
        </aside>
        <div className="auth-form">
          <h2>{isRegister ? "Konto erstellen" : "Willkommen zurück"}</h2>
          <form className="stack" onSubmit={(event) => void onSubmit(event)}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail"
              type="email"
              required
              autoComplete={isRegister ? "email" : "username"}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort (mind. 8 Zeichen)"
              type="password"
              minLength={8}
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            {isRegister && (
              <>
                <input
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                  type="password"
                  autoComplete="new-password"
                />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" />
                <div className="address-autocomplete">
                  <input
                    value={addressSearch}
                    onChange={(e) => setAddressSearch(e.target.value)}
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
                    onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
                    placeholder="Straße"
                    autoComplete="address-line1"
                  />
                  <input
                    value={address.houseNumber}
                    onChange={(e) => setAddress((prev) => ({ ...prev, houseNumber: e.target.value }))}
                    placeholder="Hausnummer"
                    autoComplete="address-line2"
                  />
                  <input
                    value={address.postalCode}
                    onChange={(e) => setAddress((prev) => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="PLZ"
                    autoComplete="postal-code"
                  />
                  <input
                    value={address.city}
                    onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Ort"
                    autoComplete="address-level2"
                  />
                  <input
                    value={address.country}
                    onChange={(e) => setAddress((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="Land"
                    autoComplete="country-name"
                  />
                </div>
                {addressPreview.length > 0 && (
                  <p className="address-preview" aria-live="polite">
                    {addressPreview}
                  </p>
                )}
              </>
            )}
            {redirectHint && <p className="status-pill">{redirectHint}</p>}
            {error && <p className="status-pill danger">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Bitte warten..." : isRegister ? "Registrieren und starten" : "Einloggen"}
            </button>
          </form>
          <button className="auth-switch" type="button" onClick={() => setIsRegister((v) => !v)}>
            {isRegister ? "Du hast schon ein Konto? Zum Login" : "Neu bei Toolshare? Jetzt registrieren"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppWithProviders />
      <ToastViewport />
    </ToastProvider>
  );
}

function AppWithProviders() {
  const {
    token,
    users,
    currentUser,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile
  } = useSession();

  if (isLoading) return <p>Lade Session...</p>;

  return (
    <Routes>
      <Route
        path="/"
        element={<Layout users={users} currentUser={currentUser ?? undefined} onSwitchUser={() => undefined} onLogout={logout} />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="tools" element={<ToolsPage token={token ?? undefined} />} />
        <Route path="tools/:id" element={<ToolDetailPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route path="tools/:id" element={<ToolDetailPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route
          path="tools/new"
          element={
            <RequireAuth token={token}>
              <NewToolPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route path="workshops" element={<WorkshopsPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route
          path="workshops/new"
          element={
            <RequireAuth token={token}>
              <NewWorkshopPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route
          path="workshops/:id/edit"
          element={
            <RequireAuth token={token}>
              <EditWorkshopPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route
          path="workshops/availability"
          element={
            <RequireAuth token={token}>
              <WorkshopAvailabilityPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route
          path="profile"
          element={
            <RequireAuth token={token}>
              <ProfileSettingsPage currentUser={currentUser ?? undefined} onSave={updateProfile} />
            </RequireAuth>
          }
        />
        <Route
          path="inbox"
          element={
            <RequireAuth token={token}>
              <InboxPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        {(currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN") && (
          <Route path="moderation" element={<ModerationPage currentUser={currentUser} token={token ?? undefined} />} />
        )}
        {currentUser?.role === "ADMIN" && (
          <Route path="admin" element={<AdminPage currentUser={currentUser} token={token ?? undefined} />} />
        )}
        <Route
          path="auth"
          element={
            currentUser && token ? (
              <Navigate to="/" replace />
            ) : (
              <AuthScreen onLogin={login} onRegister={register} error={error} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ token, children }: { token: string | null; children: JSX.Element }) {
  const location = useLocation();

  if (!token) {
    return <Navigate to="/auth" replace state={{ redirectHint: "Bitte melde dich an, um diese Funktion zu nutzen.", from: location.pathname }} />;
  }

  return children;
}
