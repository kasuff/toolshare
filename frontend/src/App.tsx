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
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

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
      <section className={`auth-card ${isRegister ? "register-mode" : ""}`}>
        <aside className="auth-brand">
          <p className="eyebrow">Toolshare Community</p>
          <h1>Teilen, buchen, gemeinsam bauen.</h1>
          <p>
            Plattform für Werkzeuge und Werkstätten in der Nachbarschaft.
          </p>
        </aside>
        <div className="auth-form">
          <h2>{isRegister ? "Konto erstellen" : "Willkommen zurück"}</h2>
          <form className="stack" onSubmit={(event) => void onSubmit(event)}>
            <label className="form-label">
              <span>E-Mail *</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail"
                type="email"
                required
                autoComplete={isRegister ? "email" : "username"}
              />
            </label>
            {!isRegister && (
              <label className="form-label">
                <span>Passwort *</span>
                <div className="password-input-wrapper">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Passwort (mind. 8 Zeichen)"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                  >
                    {showPassword ? (
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>
            )}
            {isRegister && (
              <>
                <label className="form-label">
                  <span>Name *</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="form-label">
                  <span>Adresse suchen (optional)</span>
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
                </label>
                <p className="hint">Mindestens 3 Zeichen eingeben, um Adressvorschläge zu sehen.</p>
                <div className="address-grid">
                  <label className="form-label address-field-street">
                    <span>Straße *</span>
                    <input
                      value={address.street}
                      onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
                      placeholder="Straße"
                      autoComplete="address-line1"
                    />
                  </label>
                  <label className="form-label">
                    <span>Hausnummer *</span>
                    <input
                      value={address.houseNumber}
                      onChange={(e) => setAddress((prev) => ({ ...prev, houseNumber: e.target.value }))}
                      placeholder="Hausnummer"
                      autoComplete="address-line2"
                    />
                  </label>
                  <label className="form-label">
                    <span>PLZ *</span>
                    <input
                      value={address.postalCode}
                      onChange={(e) => setAddress((prev) => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="PLZ"
                      autoComplete="postal-code"
                    />
                  </label>
                  <label className="form-label address-field-city">
                    <span>Ort *</span>
                    <input
                      value={address.city}
                      onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="Ort"
                      autoComplete="address-level2"
                    />
                  </label>
                  <label className="form-label address-field-country">
                    <span>Land *</span>
                    <input
                      value={address.country}
                      onChange={(e) => setAddress((prev) => ({ ...prev, country: e.target.value }))}
                      placeholder="Land"
                      autoComplete="country-name"
                    />
                  </label>
                </div>
                <label className="form-label">
                  <span>Passwort *</span>
                  <div className="password-input-wrapper">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Passwort (mind. 8 Zeichen)"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                    >
                      {showPassword ? (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
                <label className="form-label">
                  <span>Passwort wiederholen *</span>
                  <div className="password-input-wrapper">
                    <input
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      type={showRepeatPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                      aria-label={showRepeatPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                    >
                      {showRepeatPassword ? (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
              </>
            )}
            {redirectHint && <p className="status-pill">{redirectHint}</p>}
            {error && <p className="status-pill danger">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Bitte warten..." : isRegister ? "Registrieren und starten" : "Einloggen"}
            </button>
          </form>
          <button className="auth-switch" type="button" onClick={() => setIsRegister((v) => !v)}>
            {isRegister ? (
              <>
                <span className="auth-switch-text">Du hast schon ein Konto? </span>
                <span className="auth-switch-link">Zum Login</span>
              </>
            ) : (
              <>
                <span className="auth-switch-text">Neu bei Toolshare? </span>
                <span className="auth-switch-link">Jetzt registrieren</span>
              </>
            )}
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
        <Route path="workshops" element={<WorkshopsPage token={token ?? undefined} />} />
        <Route
          path="workshops/new"
          element={
            <RequireAuth token={token}>
              <NewWorkshopPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
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
