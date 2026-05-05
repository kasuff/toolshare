import { FormEvent, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastViewport } from "./components/ui";
import { useSession } from "./hooks/useSession";
import { ToastProvider, useToast } from "./hooks/useToast";
import { DashboardPage } from "./pages/DashboardPage";
import { ToolsPage } from "./pages/ToolsPage";
import { NewToolPage } from "./pages/NewToolPage";
import { WorkshopsPage } from "./pages/WorkshopsPage";
import { NewWorkshopPage } from "./pages/NewWorkshopPage";
import { InboxPage } from "./pages/InboxPage";
import { AdminPage } from "./pages/AdminPage";
import { ModerationPage } from "./pages/ModerationPage";

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
    role?: "USER" | "MODERATOR" | "MANAGER";
  }) => Promise<void>;
  error: string | null;
}) {
  const { pushToast } = useToast();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<"USER" | "MODERATOR" | "MANAGER">("USER");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (isRegister) {
        await onRegister({ email, password, name, address, role });
        pushToast("Konto erstellt und eingeloggt.", "success");
        return;
      }
      await onLogin(email, password);
      pushToast("Erfolgreich eingeloggt.", "success");
    } catch (submitError) {
      pushToast(submitError instanceof Error ? submitError.message : "Authentifizierung fehlgeschlagen.", "error");
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
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              type="password"
              minLength={8}
              required
            />
            {isRegister && (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" minLength={2} required />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adresse"
                  minLength={5}
                  required
                />
                <label className="field">
                  <span>Rolle für Demo-Account</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as "USER" | "MODERATOR" | "MANAGER")}>
                    <option value="USER">USER</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </label>
              </>
            )}
            {error && <p className="status-pill danger">{error}</p>}
            <button type="submit">{isRegister ? "Registrieren und starten" : "Einloggen"}</button>
          </form>
          <button className="auth-switch" onClick={() => setIsRegister((v) => !v)}>
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
  const { token, users, currentUser, isLoading, error, login, register, logout } = useSession();

  if (isLoading) return <p>Lade Session...</p>;

  return (
    <Routes>
      <Route
        path="/"
        element={<Layout users={users} currentUser={currentUser ?? undefined} onSwitchUser={() => undefined} onLogout={logout} />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="tools" element={<ToolsPage token={token ?? undefined} />} />
        <Route path="tools/new" element={<NewToolPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        <Route path="workshops" element={<WorkshopsPage token={token ?? undefined} />} />
        <Route
          path="workshops/new"
          element={<NewWorkshopPage currentUser={currentUser ?? undefined} token={token ?? undefined} />}
        />
        <Route path="inbox" element={<InboxPage currentUser={currentUser ?? undefined} token={token ?? undefined} />} />
        {currentUser?.role === "MODERATOR" && (
          <Route path="moderation" element={<ModerationPage currentUser={currentUser} token={token ?? undefined} />} />
        )}
        {currentUser?.role === "ADMIN" && (
          <Route path="admin" element={<AdminPage currentUser={currentUser} token={token ?? undefined} />} />
        )}
        <Route path="auth" element={currentUser && token ? <Navigate to="/" replace /> : <AuthScreen onLogin={login} onRegister={register} error={error} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
