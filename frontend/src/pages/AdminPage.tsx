import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MonitoringSection } from "../components/MonitoringSection";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api, type SuspensionRequestItem, type SystemSetting, type BackendMetrics } from "@toolshare/shared";
import type { User } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";

type AdminTab = "management" | "monitoring" | "rules";

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function AdminPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [adminTab, setAdminTab] = useState<AdminTab>("management");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  type DashboardData = {
    users: User[];
    metrics: BackendMetrics;
    suspensionRequests: SuspensionRequestItem[];
    settings: SystemSetting[];
  };

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["admin", "dashboard", token, appliedSearch],
    queryFn: async () => {
      if (!token) throw new Error("No token");
      const [users, metrics, suspensionRequests, settings] = await Promise.all([
        api.listUsers(token, { search: appliedSearch || undefined }),
        api.getMetrics(token),
        api.listSuspensionRequests(token),
        api.getSystemSettings(token)
      ]);
      return { users, metrics, suspensionRequests, settings };
    },
    enabled: !!token
  });

  useEffect(() => {
    if (data?.settings) {
      setDraftValues(Object.fromEntries(data.settings.map((s) => [s.key, String(s.value)])));
    }
  }, [data?.settings]);

  const { mutate: saveSettingMut, isPending: isSavingSetting } = useMutation({
    mutationFn: async ({ setting, value }: { setting: SystemSetting; value: number }) => {
      if (!token) throw new Error("No token");
      return api.updateSystemSetting(setting.key, value, token);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      setDraftValues((prev) => ({ ...prev, [updated.key]: String(updated.value) }));
      pushToast("Einstellung wurde gespeichert.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Einstellung konnte nicht gespeichert werden.", "error");
    }
  });

  const saveSetting = (setting: SystemSetting) => {
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
    saveSettingMut({ setting, value });
  };

  const { mutate: updateRoleMut, isPending: isUpdatingRole } = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "MODERATOR" | "NUTZER" }) => {
      if (!token) throw new Error("No token");
      await api.updateUserRole(userId, role, token);
      return role;
    },
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      pushToast(role === "MODERATOR" ? "Nutzer ist jetzt Moderator." : "Moderator-Rolle wurde entfernt.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Rolle konnte nicht aktualisiert werden.", "error");
    }
  });

  const { mutate: updateSuspensionMut, isPending: isUpdatingSuspension } = useMutation({
    mutationFn: async ({ userId, isSuspended }: { userId: string; isSuspended: boolean }) => {
      if (!token) throw new Error("No token");
      await api.updateUserSuspension(userId, isSuspended, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Sperrstatus konnte nicht aktualisiert werden.", "error");
    }
  });

  const { mutate: decideSuspensionMut, isPending: isDecidingSuspension } = useMutation({
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      if (!token) throw new Error("No token");
      await api.decideSuspensionRequest(requestId, { approve }, token);
      return approve;
    },
    onSuccess: (approve) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      pushToast(approve ? "Sperrung wurde durchgeführt." : "Sperranfrage abgelehnt.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Sperranfrage konnte nicht bearbeitet werden.", "error");
    }
  });

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
    <nav className="monitoring-tabs admin-tabs" aria-label="Admin-Bereiche">
      <button
        type="button"
        className={`monitoring-tab ${adminTab === "management" ? "active" : ""}`}
        aria-pressed={adminTab === "management"}
        onClick={() => setAdminTab("management")}
      >
        Verwaltung
      </button>
      <button
        type="button"
        className={`monitoring-tab ${adminTab === "rules" ? "active" : ""}`}
        aria-pressed={adminTab === "rules"}
        onClick={() => setAdminTab("rules")}
      >
        Systemregeln
      </button>
      <button
        type="button"
        className={`monitoring-tab ${adminTab === "monitoring" ? "active" : ""}`}
        aria-pressed={adminTab === "monitoring"}
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
          {isLoading && !data && <p className="hint">Lade Systemregeln...</p>}
          {data?.settings && data.settings.length > 0 && (
            <ul className="system-settings-list">
              {data.settings.map((setting) => {
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
                        disabled={!isDirty || isSavingSetting}
                        onClick={() => saveSetting(setting)}
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
          <li>Nutzer: {data?.metrics?.users ?? 0}</li>
          <li>Werkzeuge: {data?.metrics?.tools ?? 0}</li>
          <li>Werkstätten: {data?.metrics?.workshops ?? 0}</li>
          <li>Offene Buchungen: {data?.metrics?.openBookings ?? 0}</li>
          <li>Offene Meldungen: {data?.metrics?.openReports ?? 0}</li>
          <li>Offene Sperranfragen: {data?.metrics?.openSuspensionRequests ?? 0}</li>
        </ul>
      </Surface>

      <Surface
        title="Sperranfragen"
        subtitle="Von Moderatoren angeforderte Kontosperrungen – hier annehmen oder ablehnen."
      >
        {!data?.suspensionRequests?.length ? (
          <EmptyState title="Keine offenen Sperranfragen" text="Derzeit liegt keine Sperranfrage zur Entscheidung vor." />
        ) : (
          <ul className="moderation-report-list">
            {data.suspensionRequests.map((request) => (
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
                    disabled={isDecidingSuspension}
                    onClick={() => decideSuspensionMut({ requestId: request.id, approve: true })}
                  >
                    Sperrung annehmen
                  </button>
                  <button
                    type="button"
                    className="btn secondary mini"
                    disabled={isDecidingSuspension}
                    onClick={() => decideSuspensionMut({ requestId: request.id, approve: false })}
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
        <form className="row admin-user-search" onSubmit={onSearchSubmit} aria-label="Nutzerverwaltung durchsuchen">
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
        {!isLoading && !data?.users?.length && (
          <EmptyState
            title="Keine Nutzer gefunden"
            text={appliedSearch ? "Zu deiner Suche gibt es keine Treffer." : "Derzeit sind keine Nutzerdaten verfügbar."}
          />
        )}

        {!isLoading && data?.users && data.users.length > 0 && (
          <div className="table-scroll admin-user-table-scroll">
            <table className="admin-user-table">
              <caption className="visually-hidden">
                Nutzerverwaltung mit Rollen, Kontostatus und verfügbaren Aktionen
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nutzer</th>
                  <th scope="col">Rolle</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      <div className="admin-user-meta">
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </th>
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
                          onClick={() => updateRoleMut({ userId: user.id, role: user.role === "MODERATOR" ? "NUTZER" : "MODERATOR" })}
                          disabled={isUpdatingRole || user.role === "ADMIN"}
                          aria-label={
                            user.role === "MODERATOR"
                              ? `Moderatorrolle von ${user.name} entfernen`
                              : `${user.name} zum Moderator machen`
                          }
                        >
                          {user.role === "MODERATOR" ? "Moderator entfernen" : "Zum Moderator machen"}
                        </button>
                        <button
                          type="button"
                          className={`btn mini ${user.isSuspended ? "secondary" : ""}`.trim()}
                          onClick={() => updateSuspensionMut({ userId: user.id, isSuspended: !user.isSuspended })}
                          disabled={isUpdatingSuspension || user.role === "ADMIN" || user.id === currentUser?.id}
                          aria-label={`${user.name} ${user.isSuspended ? "entsperren" : "sperren"}`}
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
