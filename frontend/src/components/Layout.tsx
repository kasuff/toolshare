import { Link, NavLink, Outlet } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
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
