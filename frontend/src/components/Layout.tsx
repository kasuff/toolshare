import { Link, NavLink, Outlet } from "react-router-dom";
import type { User } from "../types/domain";
import { RoleSwitcher } from "./RoleSwitcher";

type Props = {
  users: User[];
  currentUser?: User;
  onSwitchUser: (userId: string) => void;
};

export function Layout({ users, currentUser, onSwitchUser }: Props) {
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
        </nav>
        <RoleSwitcher users={users} currentUserId={currentUser?.id} onChange={onSwitchUser} />
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
