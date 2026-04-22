import { Link, NavLink, Outlet } from "react-router-dom";
import type { User } from "../types/domain";
import { RoleSwitcher } from "./RoleSwitcher";
import { GuestBanner } from "./ui";

type Props = {
  users: User[];
  currentUser?: User;
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
};

export function Layout({ users, currentUser, onSwitchUser, onLogout }: Props) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="logo">
          Tool<strong>Share</strong>
        </Link>
        <nav className="nav">
          <NavLink to="/">Entdecken</NavLink>
          <NavLink to="/tools">Werkzeuge</NavLink>
          <NavLink to="/workshops">Werkstätten</NavLink>
          {currentUser && <NavLink to="/inbox">Inbox</NavLink>}
          {currentUser && <NavLink to="/tools/new">Anbieten</NavLink>}
          {currentUser && <NavLink to="/workshops/new">Werkstatt anlegen</NavLink>}
          {currentUser?.role === "MODERATOR" && <NavLink to="/moderation">Moderation</NavLink>}
          {currentUser?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-right">
          {users.length > 1 && <RoleSwitcher users={users} currentUserId={currentUser?.id} onChange={onSwitchUser} />}
          {currentUser ? (
            <button className="ghost btn secondary" onClick={onLogout}>
              Ausloggen
            </button>
          ) : (
            <Link className="btn secondary" to="/auth">
              Einloggen
            </Link>
          )}
        </div>
      </header>

      <main className="content">
        {!currentUser ? (
          <GuestBanner text="Du nutzt ToolShare aktuell im Gastmodus. Ansehen ist möglich, für Buchungen und Angebote musst du dich einloggen." />
        ) : (
          <p className="session-info">
            <span>
              Angemeldet als <strong>{currentUser.name}</strong>
            </span>
            <span className="status-pill neutral">{currentUser.role}</span>
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
