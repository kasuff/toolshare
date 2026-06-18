import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import type { User } from "../types/domain";
import { api } from "../services/api";
import {
  countUnreadInboxThreads,
  INBOX_READ_CHANGED_EVENT,
  loadReadMessageIds,
} from "../utils/inboxMessageRead";
import { RoleSwitcher } from "./RoleSwitcher";

type Props = {
  users: User[];
  currentUser?: User;
  token?: string | null;
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
};

export function Layout({ users, currentUser, token, onSwitchUser, onLogout }: Props) {
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const closeProfileMenu = () => {
      if (profileMenuRef.current) {
        profileMenuRef.current.open = false;
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        closeProfileMenu();
      }
    };

    const handleScroll = () => {
      closeProfileMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMobileNavOpen]);

  const [unreadRequestBellCount, setUnreadRequestBellCount] = useState(0);

  useEffect(() => {
    if (!token || !currentUser?.id) {
      setUnreadRequestBellCount(0);
      return;
    }

    let cancelled = false;
    const userId = currentUser.id;

    const loadUnreadRequestsForBell = async () => {
      try {
        const [bookings, notifications] = await Promise.all([
          api.getBookingsForUser(token),
          api.getNotifications(token)
        ]);
        if (cancelled) return;
        const readIds = loadReadMessageIds(userId);
        let count = countUnreadInboxThreads(bookings, userId, readIds);
        
        const unreadNotifications = notifications.filter(
          (n) =>
            !n.read &&
            (n.message.startsWith("ERMAHNUNG:") ||
              n.message.startsWith("SPERRUNG:") ||
              n.message.includes("wurde storniert") ||
              n.message.includes("wurde gelöscht"))
        );
        count += unreadNotifications.length;

        setUnreadRequestBellCount(count);
      } catch {
        if (!cancelled) setUnreadRequestBellCount(0);
      }
    };

    void loadUnreadRequestsForBell();
    const intervalId = window.setInterval(() => void loadUnreadRequestsForBell(), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadUnreadRequestsForBell();
    };
    const onInboxReadChanged = () => void loadUnreadRequestsForBell();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(INBOX_READ_CHANGED_EVENT, onInboxReadChanged);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(INBOX_READ_CHANGED_EVENT, onInboxReadChanged);
    };
  }, [token, currentUser?.id, location.pathname]);

  const inboxAriaLabel =
    unreadRequestBellCount > 0
      ? `Nachrichten und Benachrichtigungen, ${unreadRequestBellCount} ungelesene Konversationen`
      : "Nachrichten und Benachrichtigungen";

  const badgeText =
    unreadRequestBellCount > 99 ? "99+" : unreadRequestBellCount > 0 ? String(unreadRequestBellCount) : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="logo">
          Tool<strong>Share</strong>
        </Link>
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-controls="primary-navigation"
          aria-expanded={isMobileNavOpen}
          aria-label={isMobileNavOpen ? "Navigation schließen" : "Navigation öffnen"}
          onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {isMobileNavOpen ? "close" : "menu"}
          </span>
        </button>
        <nav id="primary-navigation" className={`nav ${isMobileNavOpen ? "nav-open" : ""}`}>
          <NavLink to="/">Entdecken</NavLink>
          
          {/* Werkzeuge link */}
          <NavLink to="/tools" className={({ isActive }) => (isActive ? 'active' : '')}>
            Werkzeuge
          </NavLink>

          {/* Werkstätten link (no dropdown) */}
          <NavLink to="/workshops" className={({ isActive }) => (isActive ? 'active' : '')}>
            Werkstätten
          </NavLink>

          {(currentUser?.role === "MODERATOR" || currentUser?.role === "ADMIN") && <NavLink to="/moderation">Moderation</NavLink>}
          {currentUser?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="topbar-right">
          {users.length > 1 && <RoleSwitcher users={users} currentUserId={currentUser?.id} onChange={onSwitchUser} />}
          {currentUser ? (
            <>
              <Link to="/inbox" className="notification-bell-wrap" aria-label={inboxAriaLabel}>
                <span className="notification-bell">
                  <svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                    <path d="M12 3.75a6 6 0 0 0-6 6v2.5a4.5 4.5 0 0 1-.92 2.72L3.8 16.62a1.5 1.5 0 0 0 1.2 2.38h14a1.5 1.5 0 0 0 1.2-2.38l-1.28-1.65a4.5 4.5 0 0 1-.92-2.72v-2.5a6 6 0 0 0-6-6Zm0 18a3.25 3.25 0 0 0 3.03-2.06.75.75 0 1 0-1.39-.57 1.75 1.75 0 0 1-3.28 0 .75.75 0 1 0-1.39.57A3.25 3.25 0 0 0 12 21.75Z" />
                  </svg>
                </span>
                {badgeText !== null && (
                  <span className="notification-bell-badge" aria-hidden="true">
                    {badgeText}
                  </span>
                )}
              </Link>
              <details className="profile-menu" ref={profileMenuRef}>
                <summary aria-label="Profil-Menü öffnen">
                  <span className="profile-avatar" aria-hidden="true">
                    <svg viewBox="0 0 24 24" role="img" focusable="false">
                      <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.14 0-7.5 2.69-7.5 6a.75.75 0 0 0 1.5 0c0-2.47 2.69-4.5 6-4.5s6 2.03 6 4.5a.75.75 0 0 0 1.5 0c0-3.31-3.36-6-7.5-6Z" />
                    </svg>
                  </span>
                </summary>
                <div className="profile-menu-panel">
                  <p className="profile-menu-meta">{currentUser.name}</p>
                  <Link to="/offers" className="profile-menu-item">
                    Meine Angebote
                  </Link>
                  <Link to="/profile" className="profile-menu-item">
                    Einstellungen
                  </Link>
                  <button type="button" className="profile-menu-item profile-menu-logout" onClick={onLogout}>
                    Ausloggen
                  </button>
                </div>
              </details>
            </>
          ) : (
            <Link className="btn ghost" to="/auth">
              Einloggen
            </Link>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="site-footer-brand">
            Tool<strong>Share</strong>
          </span>
          <nav className="site-footer-nav" aria-label="Rechtliche Informationen">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutzerklärung</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
