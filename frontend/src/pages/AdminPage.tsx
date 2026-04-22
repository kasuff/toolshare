import { useMemo, useState } from "react";
import { api } from "../services/mockApi";
import type { Role, User } from "../types/domain";

type Props = {
  currentUser: User;
};

export function AdminPage({ currentUser }: Props) {
  const users = useMemo(() => api.getUsers(), [currentUser.id]);
  const metrics = useMemo(() => api.getMetrics(), [currentUser.id]);
  const [rules, setRules] = useState(api.getRules());

  const updateRole = (userId: string, role: Role) => {
    api.updateUserRole(userId, role);
    window.location.reload();
  };

  const toggleSuspended = (userId: string) => {
    api.toggleUserSuspended(userId);
    window.location.reload();
  };

  const saveRule = (id: string, text: string) => {
    api.updateRule(id, text);
    setRules(api.getRules());
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
                <td>
                  <button className="ghost" onClick={() => toggleSuspended(u.id)}>
                    {u.isSuspended ? "Entsperren" : "Sperren"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Systemregeln</h2>
        {rules.map((r) => (
          <div key={r.id} className="row">
            <input
              value={r.text}
              onChange={(e) =>
                setRules((prev) =>
                  prev.map((it) => (it.id === r.id ? { ...it, text: e.target.value } : it)),
                )
              }
            />
            <button onClick={() => saveRule(r.id, r.text)}>Speichern</button>
          </div>
        ))}
      </div>
    </section>
  );
}
