import { Link, NavLink, Outlet } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import type { User } from "../types/domain";
import { RoleSwitcher } from "./RoleSwitcher";

type Props = {
  users: User[];
  currentUser?: User;
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
};

export function Layout({ users, currentUser, onSwitchUser, onLogout }: Props) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (dropdownId: string) => {
    setActiveDropdown(activeDropdown === dropdownId ? null : dropdownId);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="logo">
          Tool<strong>Share</strong>
        </Link>
        <nav className="nav" ref={dropdownRef}>
          <NavLink to="/">Entdecken</NavLink>
          
          {/* Werkzeuge link */}
          <NavLink to="/tools" className={({ isActive }) => (isActive ? 'active' : '')}>
            Werkzeuge
          </NavLink>

          {/* Werkstätten link (no dropdown) */}
          <NavLink to="/workshops" className={({ isActive }) => (isActive ? 'active' : '')}>
            Werkstätten
          </NavLink>

          {currentUser && <NavLink to="/inbox">Inbox</NavLink>}
          {(currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN") && <NavLink to="/moderation">Moderation</NavLink>}
          {currentUser?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-right">
          {users.length > 1 && <RoleSwitcher users={users} currentUserId={currentUser?.id} onChange={onSwitchUser} />}
          {currentUser ? (
            <details className="profile-menu">
              <summary aria-label="Profil-Menü öffnen">
                <span className="profile-avatar" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img" focusable="false">
                    <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.14 0-7.5 2.69-7.5 6a.75.75 0 0 0 1.5 0c0-2.47 2.69-4.5 6-4.5s6 2.03 6 4.5a.75.75 0 0 0 1.5 0c0-3.31-3.36-6-7.5-6Z" />
                  </svg>
                </span>
              </summary>
              <div className="profile-menu-panel">
                <p className="profile-menu-meta">{currentUser.name}</p>
                <Link to="/profile" className="profile-menu-item">
                  Settings
                </Link>
                <button type="button" className="profile-menu-item profile-menu-logout" onClick={onLogout}>
                  Ausloggen
                </button>
              </div>
            </details>
          ) : (
            <Link className="btn secondary" to="/auth">
              Einloggen
            </Link>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
