import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MonitoringSection } from "../components/MonitoringSection";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api, type SuspensionRequestItem } from "../services/api";
import type { User } from "../types/domain";

type AdminTab = "management" | "monitoring" | "rules";

type SystemRule = { id: string; text: string };

type Props = {
  currentUser?: User;
  token?: string;
};

export function AdminPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const [adminTab, setAdminTab] = useState<AdminTab>("management");
  const [users, setUsers] = useState<User[]>([]);
  const [suspensionRequests, setSuspensionRequests] = useState<SuspensionRequestItem[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [rules, setRules] = useState<SystemRule[]>([]);
  const [newRuleText, setNewRuleText] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleText, setEditingRuleText] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);
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
      const [nextUsers, nextMetrics, nextSuspensionRequests, nextRules] = await Promise.all([
        api.listUsers(token, { search: search || undefined }),
        api.getMetrics(token),
        api.listSuspensionRequests(token),
        api.listSystemRules(token)
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
      setRules(nextRules);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const addRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !newRuleText.trim()) return;
    setIsSavingRule(true);
    try {
      const created = await api.createSystemRule(newRuleText.trim(), token);
      setRules((prev) => [...prev, created]);
      setNewRuleText("");
      pushToast("Regel wurde hinzugefügt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Regel konnte nicht erstellt werden.", "error");
    } finally {
      setIsSavingRule(false);
    }
  };

  const saveRule = async (id: string) => {
    if (!token || !editingRuleText.trim()) return;
    setIsSavingRule(true);
    try {
      const updated = await api.updateSystemRule(id, editingRuleText.trim(), token);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setEditingRuleId(null);
      setEditingRuleText("");
      pushToast("Regel wurde gespeichert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Regel konnte nicht gespeichert werden.", "error");
    } finally {
      setIsSavingRule(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!token) return;
    setIsSavingRule(true);
    try {
      await api.deleteSystemRule(id, token);
      setRules((prev) => prev.filter((r) => r.id !== id));
      pushToast("Regel wurde gelöscht.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Regel konnte nicht gelöscht werden.", "error");
    } finally {
      setIsSavingRule(false);
    }
  };

  const startEditing = (rule: SystemRule) => {
    setEditingRuleId(rule.id);
    setEditingRuleText(rule.text);
  };

  const cancelEditing = () => {
    setEditingRuleId(null);
    setEditingRuleText("");
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
      pushToast(nextIsSuspended ? "Nutzer wurde gesperrt." : "Nutzer wurde entsperrt.", "success");
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

  const tabNav = (
    <nav className="monitoring-tabs">
      <button
        type="button"
        className={`monitoring-tab ${adminTab === "management" ? "active" : ""}`}
        onClick={() => setAdminTab("management")}
      >
        Verwaltung
      </button>
      <button
        type="button"
        className={`monitoring-tab ${adminTab === "rules" ? "active" : ""}`}
        onClick={() => setAdminTab("rules")}
      >
        Systemregeln
      </button>
      <button
        type="button"
        className={`monitoring-tab ${adminTab === "monitoring" ? "active" : ""}`}
        onClick={() => setAdminTab("monitoring")}
      >
        Monitoring
      </button>
    </nav>
  );

  if (adminTab === "monitoring") {
    return (
      <section className="stack">
        <h1>Admin</h1>
        {tabNav}
        <MonitoringSection token={token} />
      </section>
    );
  }

  if (adminTab === "rules") {
    return (
      <section className="stack">
        <h1>Admin</h1>
        {tabNav}
        <Surface
          title="Systemregeln"
          subtitle="Regeln gelten plattformweit und werden allen Nutzern angezeigt."
        >
          {rules.length === 0 && !isLoading && (
            <EmptyState title="Keine Regeln" text="Es wurden noch keine Systemregeln definiert." />
          )}
          {rules.length > 0 && (
            <ul className="moderation-report-list">
              {rules.map((rule) => (
                <li key={rule.id} className="inbox-item moderation-report">
                  {editingRuleId === rule.id ? (
                    <div className="stack">
                      <textarea
                        className="rule-textarea"
                        value={editingRuleText}
                        onChange={(e) => setEditingRuleText(e.target.value)}
                        rows={3}
                        aria-label="Regeltext bearbeiten"
                      />
                      <div className="moderation-actions">
                        <button
                          type="button"
                          className="btn mini"
                          disabled={isSavingRule || !editingRuleText.trim()}
                          onClick={() => void saveRule(rule.id)}
                        >
                          Speichern
                        </button>
                        <button
                          type="button"
                          className="btn secondary mini"
                          disabled={isSavingRule}
                          onClick={cancelEditing}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="stack">
                      <p>{rule.text}</p>
                      <div className="moderation-actions">
                        <button
                          type="button"
                          className="btn secondary mini"
                          disabled={isSavingRule}
                          onClick={() => startEditing(rule)}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="btn mini"
                          disabled={isSavingRule}
                          onClick={() => void deleteRule(rule.id)}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form className="stack" onSubmit={(e) => void addRule(e)}>
            <label className="form-label">
              <span>Neue Regel hinzufügen</span>
              <textarea
                className="rule-textarea"
                value={newRuleText}
                onChange={(e) => setNewRuleText(e.target.value)}
                placeholder="Regeltext eingeben..."
                rows={2}
                aria-label="Neue Systemregel"
              />
            </label>
            <div className="row">
              <button
                type="submit"
                className="btn"
                disabled={isSavingRule || !newRuleText.trim()}
              >
                Regel hinzufügen
              </button>
            </div>
          </form>
        </Surface>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Admin</h1>
      {tabNav}
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
