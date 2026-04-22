import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { Role, User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function AdminPage({ token }: Props) {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState({
    users: 0,
    tools: 0,
    workshops: 0,
    openBookings: 0,
    openReports: 0
  });

  const loadData = async () => {
    if (!token) return;
    try {
      const [nextUsers, nextMetrics] = await Promise.all([api.listUsers(token), api.getMetrics(token)]);
      setUsers(nextUsers);
      setMetrics(nextMetrics);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.", "error");
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData();
  }, [token]);

  const updateRole = async (userId: string, role: Role) => {
    if (!token) return;
    try {
      await api.updateUserRole(userId, role, token);
      await loadData();
      pushToast("Rolle aktualisiert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Rolle konnte nicht aktualisiert werden.", "error");
    }
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
      <Surface title="Systemnutzung">
        <ul className="meta-list">
          <li>Nutzer: {metrics.users}</li>
          <li>Werkzeuge: {metrics.tools}</li>
          <li>Werkstätten: {metrics.workshops}</li>
          <li>Offene Buchungen: {metrics.openBookings}</li>
          <li>Offene Meldungen: {metrics.openReports}</li>
        </ul>
      </Surface>

      <Surface title="Nutzer und Rollen">
        {users.length === 0 && <EmptyState title="Keine Nutzer gefunden" text="Derzeit sind keine Nutzerdaten verfügbar." />}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value as Role)}>
                    <option value="NUTZER">NUTZER</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td>{u.isSuspended ? "Gesperrt" : "Aktiv"}</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </section>
  );
}
