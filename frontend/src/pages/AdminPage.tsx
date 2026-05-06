import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function AdminPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    users: 0,
    tools: 0,
    workshops: 0,
    openBookings: 0,
    openReports: 0
  });

  const loadData = async (search: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [nextUsers, nextMetrics] = await Promise.all([
        api.listUsers(token, { search: search || undefined }),
        api.getMetrics(token)
      ]);
      setUsers(nextUsers);
      setMetrics(nextMetrics);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData(appliedSearch);
  }, [token, appliedSearch]);

  const updateRole = async (userId: string, role: "MODERATOR" | "NUTZER") => {
    if (!token) return;
    setBusyUserId(userId);
    try {
      await api.updateUserRole(userId, role, token);
      await loadData(appliedSearch);
      pushToast(role === "MODERATOR" ? "Nutzer ist jetzt Moderator." : "Moderator-Rolle wurde entfernt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Rolle konnte nicht aktualisiert werden.", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const updateSuspension = async (userId: string, nextIsSuspended: boolean) => {
    if (!token) return;
    setBusyUserId(userId);
    try {
      await api.updateUserSuspension(userId, nextIsSuspended, token);
      await loadData(appliedSearch);
      pushToast(nextIsSuspended ? "Nutzer wurde gesperrt." : "Nutzer wurde entsperrt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Sperrstatus konnte nicht aktualisiert werden.", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
  };

  if (!token) {
    return (
      <section className="stack">
        <h1>Admin</h1>
        <Surface title="Login erforderlich">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Admin</h1>
      <Surface title="Systemnutzung" subtitle="Schnellüberblick über die aktuelle Plattformaktivität.">
        <ul className="meta-list">
          <li>Nutzer: {metrics.users}</li>
          <li>Werkzeuge: {metrics.tools}</li>
          <li>Werkstätten: {metrics.workshops}</li>
          <li>Offene Buchungen: {metrics.openBookings}</li>
          <li>Offene Meldungen: {metrics.openReports}</li>
        </ul>
      </Surface>

      <Surface title="Nutzerverwaltung" subtitle="Suche nach Nutzern und verwalte Rollen sowie Kontostatus.">
        <form className="row" onSubmit={onSearchSubmit}>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Nach Name oder E-Mail suchen"
            aria-label="Nutzer suchen"
          />
          <button type="submit" className="btn">
            Suchen
          </button>
          {(searchInput || appliedSearch) && (
            <button type="button" className="btn secondary" onClick={clearSearch}>
              Zurücksetzen
            </button>
          )}
        </form>

        {isLoading && <p className="hint">Lade Nutzerdaten...</p>}
        {!isLoading && users.length === 0 && (
          <EmptyState
            title="Keine Nutzer gefunden"
            text={appliedSearch ? "Zu deiner Suche gibt es keine Treffer." : "Derzeit sind keine Nutzerdaten verfügbar."}
          />
        )}

        {!isLoading && users.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Rolle</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-meta">
                        <strong>{u.name}</strong>
                        <span>{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill
                        label={u.role}
                        tone={u.role === "ADMIN" ? "warning" : u.role === "MODERATOR" ? "success" : "neutral"}
                      />
                    </td>
                    <td>
                      <StatusPill label={u.isSuspended ? "Gesperrt" : "Aktiv"} tone={u.isSuspended ? "danger" : "success"} />
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn secondary mini"
                          onClick={() => updateRole(u.id, u.role === "MODERATOR" ? "NUTZER" : "MODERATOR")}
                          disabled={busyUserId === u.id || u.role === "ADMIN"}
                        >
                          {u.role === "MODERATOR" ? "Moderator entfernen" : "Zum Moderator machen"}
                        </button>
                        <button
                          type="button"
                          className={`btn mini ${u.isSuspended ? "secondary" : ""}`.trim()}
                          onClick={() => updateSuspension(u.id, !u.isSuspended)}
                          disabled={busyUserId === u.id || u.role === "ADMIN" || u.id === currentUser?.id}
                        >
                          {u.isSuspended ? "Entsperren" : "Sperren"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </section>
  );
}
