import { Link, NavLink, Outlet } from "react-router-dom";
import type { User } from "../types/domain";
import { RoleSwitcher } from "./RoleSwitcher";

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
          ToolShare MVP
        </Link>
        <nav className="nav">
          <NavLink to="/tools">Werkzeuge</NavLink>
          <NavLink to="/tools/new">Werkzeug einstellen</NavLink>
          <NavLink to="/workshops">Werkstätten</NavLink>
          <NavLink to="/workshops/new">Werkstatt einstellen</NavLink>
          <NavLink to="/inbox">Inbox</NavLink>
          {currentUser?.role === "MODERATOR" && <NavLink to="/moderation">Moderation</NavLink>}
          {currentUser?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="row">
          {users.length > 1 && <RoleSwitcher users={users} currentUserId={currentUser?.id} onChange={onSwitchUser} />}
          <button className="ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="content">
        {!currentUser ? (
          <p>Kein Nutzer aktiv.</p>
        ) : (
          <>
            <p className="session-info">
              Angemeldet als <strong>{currentUser.name}</strong> ({currentUser.role})
            </p>
            <Outlet />
          </>
        )}
      </main>
    </div>
  );
}
