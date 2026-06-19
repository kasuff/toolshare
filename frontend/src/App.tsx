import { FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AddressInput } from "./components/AddressInput";
import { EMPTY_ADDRESS, isAddressComplete, toAddressPayload } from "./utils/address";
import { Layout } from "./components/Layout";
import { GlobalProgressBar } from "./components/GlobalProgressBar";
import { ToastViewport } from "./components/ui";
import { useSession } from "./hooks/useSession";
import { ToastProvider, useToast } from "./hooks/useToast";
import { DashboardPage } from "./pages/DashboardPage";
import { ToolsPage } from "./pages/ToolsPage";
import { ToolDetailPage } from "./pages/ToolDetailPage";
import { EditToolPage } from "./pages/EditToolPage";
import { NewToolPage } from "./pages/NewToolPage";
import { WorkshopsPage } from "./pages/WorkshopsPage";
import { NewWorkshopPage } from "./pages/NewWorkshopPage";
import { EditWorkshopPage } from "./pages/EditWorkshopPage";
import { WorkshopAvailabilityPage } from "./pages/WorkshopAvailabilityPage";
import { InboxPage } from "./pages/InboxPage";
import { AdminPage } from "./pages/AdminPage";
import { ModerationPage } from "./pages/ModerationPage";
import { MyOffersPage } from "./pages/MyOffersPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { api } from "./services/api";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "./services/sessionEvents";
import { ImpressumPage } from "./pages/ImpressumPage";
import { DatenschutzPage } from "./pages/DatenschutzPage";

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
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const repeatPasswordTouched = repeatPassword.length > 0;
  const passwordsMatch = password.length > 0 && password === repeatPassword;
  const passwordsMismatch = repeatPasswordTouched && password !== repeatPassword;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isRegister) {
        if (passwordsMismatch) {
          throw new Error("Passwörter stimmen nicht überein.");
        }
        if (!isAddressComplete(address)) {
          throw new Error("Bitte Straße, Hausnummer, PLZ und Ort vollständig ausfüllen.");
        }
        const payloadAddress = toAddressPayload(address);
        const validation = await api.validateAddress(payloadAddress);
        if (!validation.isValid) {
          throw new Error("Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.");
        }
        await onRegister({ email, password, name, address: payloadAddress });
        return;
      }
      await onLogin(email, password);
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
                <div className="form-label">
                  <span>Adresse *</span>
                  <AddressInput value={address} onChange={setAddress} required compactManualLayout />
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
                      minLength={8}
                      required
                      className={passwordsMismatch ? "input-invalid" : undefined}
                      aria-invalid={passwordsMismatch}
                      aria-describedby={passwordsMismatch || passwordsMatch ? "repeat-password-feedback" : undefined}
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
                  {passwordsMismatch && (
                    <p id="repeat-password-feedback" className="field-error" role="alert">
                      Passwörter stimmen nicht überein.
                    </p>
                  )}
                  {passwordsMatch && repeatPasswordTouched && (
                    <p id="repeat-password-feedback" className="field-success" role="status">
                      Passwörter stimmen überein.
                    </p>
                  )}
                </label>
              </>
            )}
            {redirectHint && <p className="status-pill">{redirectHint}</p>}
            {error && <p className="status-pill danger" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting || (isRegister && passwordsMismatch)}>
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
      <GlobalProgressBar />
      <AppWithProviders />
      <ToastViewport />
    </ToastProvider>
  );
}

function AppWithProviders() {
  const { pushToast } = useToast();
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

  useEffect(() => {
    const handleSessionExpired = () => {
      pushToast(SESSION_EXPIRED_MESSAGE, "error");
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [pushToast]);

  if (isLoading) return <p>Lade Session...</p>;

  const handleLogout = () => {
    logout();
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            users={users}
            currentUser={currentUser ?? undefined}
            token={token}
            onSwitchUser={() => undefined}
            onLogout={handleLogout}
          />
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tools" element={<ToolsPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route path="tools/:id" element={<ToolDetailPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route
          path="tools/:id/edit"
          element={
            <RequireAuth token={token}>
              <EditToolPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route
          path="tools/new"
          element={
            <RequireAuth token={token}>
              <NewToolPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route path="workshops" element={<WorkshopsPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route path="workshops/:id" element={<WorkshopsPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
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
          path="offers"
          element={
            <RequireAuth token={token}>
              <MyOffersPage currentUser={currentUser ?? undefined} token={token ?? undefined} />
            </RequireAuth>
          }
        />
        <Route
          path="profile"
          element={
            <RequireAuth token={token}>
              <ProfileSettingsPage currentUser={currentUser ?? undefined} token={token ?? undefined} onSave={updateProfile} />
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
          <Route path="moderation" element={<ModerationPage token={token ?? undefined} />} />
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
        <Route path="impressum" element={<ImpressumPage />} />
        <Route path="datenschutz" element={<DatenschutzPage />} />
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
