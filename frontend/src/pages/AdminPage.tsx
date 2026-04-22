import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Role, User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
};

export function AdminPage({ token }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState({
    users: 0,
    tools: 0,
    workshops: 0,
    openBookings: 0,
    openReports: 0
  });

  const loadData = async () => {
    try {
      const [nextUsers, nextMetrics] = await Promise.all([api.listUsers(token), api.getMetrics(token)]);
      setUsers(nextUsers);
      setMetrics(nextMetrics);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Admin-Daten konnten nicht geladen werden.");
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const updateRole = async (userId: string, role: Role) => {
    try {
      await api.updateUserRole(userId, role, token);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Rolle konnte nicht aktualisiert werden.");
    }
  };

  return (
    <section>
      <h1>Admin</h1>
      <div className="panel">
        <h2>Systemnutzung</h2>
        <ul>
          <li>Nutzer: {metrics.users}</li>
          <li>Werkzeuge: {metrics.tools}</li>
          <li>Werkstätten: {metrics.workshops}</li>
          <li>Offene Buchungen: {metrics.openBookings}</li>
          <li>Offene Meldungen: {metrics.openReports}</li>
        </ul>
      </div>

      <div className="panel">
        <h2>Nutzer und Rollen</h2>
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
      </div>
    </section>
  );
}
