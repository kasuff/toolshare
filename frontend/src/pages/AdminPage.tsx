import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api, type SuspensionRequestItem } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function AdminPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [suspensionRequests, setSuspensionRequests] = useState<SuspensionRequestItem[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    users: 0,
    tools: 0,
    workshops: 0,
    openBookings: 0,
    openReports: 0,
    openSuspensionRequests: 0
  });

  const loadData = async (search: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [nextUsers, nextMetrics, nextSuspensionRequests] = await Promise.all([
        api.listUsers(token, { search: search || undefined }),
        api.getMetrics(token),
        api.listSuspensionRequests(token)
      ]);
      setUsers(nextUsers);
      setMetrics({
        users: nextMetrics.users,
        tools: nextMetrics.tools,
        workshops: nextMetrics.workshops,
        openBookings: nextMetrics.openBookings,
        openReports: nextMetrics.openReports,
        openSuspensionRequests: nextMetrics.openSuspensionRequests ?? 0
      });
      setSuspensionRequests(nextSuspensionRequests);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData(appliedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Sperrstatus konnte nicht aktualisiert werden.", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const decideSuspensionRequest = async (requestId: string, approve: boolean) => {
    if (!token) return;
    setBusyRequestId(requestId);
    try {
      await api.decideSuspensionRequest(requestId, { approve }, token);
      await loadData(appliedSearch);
      pushToast(approve ? "Sperrung wurde durchgeführt." : "Sperranfrage abgelehnt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Sperranfrage konnte nicht bearbeitet werden.", "error");
    } finally {
      setBusyRequestId(null);
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
          <li>Offene Sperranfragen: {metrics.openSuspensionRequests}</li>
        </ul>
      </Surface>

      <Surface
        title="Sperranfragen"
        subtitle="Von Moderatoren angeforderte Kontosperrungen – hier annehmen oder ablehnen."
      >
        {suspensionRequests.length === 0 ? (
          <EmptyState title="Keine offenen Sperranfragen" text="Derzeit liegt keine Sperranfrage zur Entscheidung vor." />
        ) : (
          <ul className="moderation-report-list">
            {suspensionRequests.map((request) => (
              <li key={request.id} className="inbox-item moderation-report">
                <p>
                  <strong>{request.user.name}</strong> ({request.user.email})
                </p>
                <p className="hint">
                  Angefragt von {request.requestedBy.name} · {new Date(request.createdAt).toLocaleString("de-DE")}
                </p>
                <p>
                  <strong>Grund:</strong> {request.reason}
                </p>
                {request.report && (
                  <p className="hint">
                    Bezug: Meldung „{request.report.reason}" ({request.report.targetType})
                  </p>
                )}
                <div className="moderation-actions">
                  <button
                    type="button"
                    className="btn mini"
                    disabled={busyRequestId === request.id}
                    onClick={() => void decideSuspensionRequest(request.id, true)}
                  >
                    Sperrung annehmen
                  </button>
                  <button
                    type="button"
                    className="btn secondary mini"
                    disabled={busyRequestId === request.id}
                    onClick={() => void decideSuspensionRequest(request.id, false)}
                  >
                    Ablehnen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-meta">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <StatusPill
                        label={user.role}
                        tone={user.role === "ADMIN" ? "warning" : user.role === "MODERATOR" ? "success" : "neutral"}
                      />
                    </td>
                    <td>
                      <StatusPill label={user.isSuspended ? "Gesperrt" : "Aktiv"} tone={user.isSuspended ? "danger" : "success"} />
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn secondary mini"
                          onClick={() => updateRole(user.id, user.role === "MODERATOR" ? "NUTZER" : "MODERATOR")}
                          disabled={busyUserId === user.id || user.role === "ADMIN"}
                        >
                          {user.role === "MODERATOR" ? "Moderator entfernen" : "Zum Moderator machen"}
                        </button>
                        <button
                          type="button"
                          className={`btn mini ${user.isSuspended ? "secondary" : ""}`.trim()}
                          onClick={() => updateSuspension(user.id, !user.isSuspended)}
                          disabled={busyUserId === user.id || user.role === "ADMIN" || user.id === currentUser?.id}
                        >
                          {user.isSuspended ? "Entsperren" : "Sperren"}
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
