import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MonitoringSection } from "../components/MonitoringSection";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api, type SuspensionRequestItem, type SystemSetting } from "../services/api";
import type { User } from "../types/domain";

type AdminTab = "management" | "monitoring" | "rules";

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
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);
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
      const [nextUsers, nextMetrics, nextSuspensionRequests, nextSettings] = await Promise.all([
        api.listUsers(token, { search: search || undefined }),
        api.getMetrics(token),
        api.listSuspensionRequests(token),
        api.getSystemSettings(token)
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
      setSettings(nextSettings);
      setDraftValues(Object.fromEntries(nextSettings.map((s) => [s.key, String(s.value)])));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (setting: SystemSetting) => {
    if (!token) return;
    const raw = draftValues[setting.key];
    const value = Number(raw);
    if (raw === undefined || raw === "" || !Number.isInteger(value)) {
      pushToast("Bitte eine ganze Zahl eingeben.", "error");
      return;
    }
    if (value < setting.min || value > setting.max) {
      pushToast(`Wert muss zwischen ${setting.min} und ${setting.max} liegen.`, "error");
      return;
    }
    setSavingSettingKey(setting.key);
    try {
      const updated = await api.updateSystemSetting(setting.key, value, token);
      setSettings((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
      setDraftValues((prev) => ({ ...prev, [updated.key]: String(updated.value) }));
      pushToast("Einstellung wurde gespeichert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Einstellung konnte nicht gespeichert werden.", "error");
    } finally {
      setSavingSettingKey(null);
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
          subtitle="Diese Werte gelten plattformweit. Nur die Zahl ist anpassbar – Änderungen werden sofort übernommen."
        >
          {isLoading && settings.length === 0 && <p className="hint">Lade Systemregeln...</p>}
          {settings.length > 0 && (
            <ul className="system-settings-list">
              {settings.map((setting) => {
                const draft = draftValues[setting.key] ?? String(setting.value);
                const isDirty = draft !== String(setting.value);
                return (
                  <li key={setting.key} className="system-setting-row">
                    <span className="system-setting-label">{setting.label}:</span>
                    <div className="system-setting-control">
                      <input
                        type="number"
                        className="system-setting-input"
                        value={draft}
                        min={setting.min}
                        max={setting.max}
                        step={1}
                        aria-label={setting.label}
                        onChange={(e) =>
                          setDraftValues((prev) => ({ ...prev, [setting.key]: e.target.value }))
                        }
                      />
                      {setting.unit && <span className="system-setting-unit">{setting.unit}</span>}
                      <button
                        type="button"
                        className="btn mini"
                        disabled={!isDirty || savingSettingKey === setting.key}
                        onClick={() => void saveSetting(setting)}
                      >
                        Speichern
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
