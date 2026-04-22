import { FormEvent, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useSession } from "./hooks/useSession";
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
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<"USER" | "MODERATOR" | "MANAGER">("USER");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isRegister) {
      await onRegister({ email, password, name, address, role });
      return;
    }
    await onLogin(email, password);
  };

  return (
    <section className="panel form" style={{ maxWidth: 560, margin: "3rem auto" }}>
      <h1>{isRegister ? "Registrieren" : "Login"}</h1>
      <form className="form" onSubmit={(event) => void onSubmit(event)}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" type="email" />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort (mind. 8 Zeichen)"
          type="password"
        />
        {isRegister && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" />
            <label>
              Rolle
              <select value={role} onChange={(e) => setRole(e.target.value as "USER" | "MODERATOR" | "MANAGER")}>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="MANAGER">MANAGER</option>
              </select>
            </label>
          </>
        )}
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">{isRegister ? "Account erstellen" : "Einloggen"}</button>
      </form>
      <button className="ghost" onClick={() => setIsRegister((v) => !v)}>
        {isRegister ? "Bereits Account? Zum Login" : "Neu hier? Registrieren"}
      </button>
    </section>
  );
}

export default function App() {
  const { token, users, currentUser, isLoading, error, login, register, logout } = useSession();

  if (isLoading) return <p>Lade Session...</p>;

  if (!currentUser || !token) {
    return <AuthScreen onLogin={login} onRegister={register} error={error} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Layout users={users} currentUser={currentUser} onSwitchUser={() => undefined} onLogout={logout} />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="tools" element={<ToolsPage currentUser={currentUser} token={token} />} />
        <Route path="tools/new" element={<NewToolPage currentUser={currentUser} token={token} />} />
        <Route path="workshops" element={<WorkshopsPage currentUser={currentUser} token={token} />} />
        <Route path="workshops/new" element={<NewWorkshopPage currentUser={currentUser} token={token} />} />
        <Route path="inbox" element={<InboxPage currentUser={currentUser} token={token} />} />
        {currentUser.role === "MODERATOR" && (
          <Route path="moderation" element={<ModerationPage currentUser={currentUser} token={token} />} />
        )}
        {currentUser.role === "ADMIN" && (
          <Route path="admin" element={<AdminPage currentUser={currentUser} token={token} />} />
        )}
      </Route>
    </Routes>
  );
}
