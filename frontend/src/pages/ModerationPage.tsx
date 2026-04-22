import { useMemo, useState } from "react";
import { api } from "../services/mockApi";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
};

export function ModerationPage({ currentUser }: Props) {
  const [decisionByReport, setDecisionByReport] = useState<Record<string, string>>({});
  const [selectedRating, setSelectedRating] = useState("");

  const reports = useMemo(() => api.getReports(), [currentUser.id]);
  const ratings = useMemo(() => api.getRatings(), [currentUser.id]);

  const resolve = (id: string) => {
    const note = decisionByReport[id] || "Moderiert ohne Zusatzkommentar";
    api.resolveReport(id, note);
    window.location.reload();
  };

  const moderateRating = () => {
    if (!selectedRating) return;
    api.moderateRating(selectedRating);
    window.location.reload();
  };

  return (
    <section>
      <h1>Moderation</h1>
      <div className="panel">
        <h2>Meldungen</h2>
        {reports.length === 0 ? (
          <p>Keine Meldungen.</p>
        ) : (
          <ul>
            {reports.map((r) => (
              <li key={r.id} className="inbox-item">
                <p>
                  <strong>{r.targetType}</strong> | {r.reason} | Status: {r.status}
                </p>
                {r.status === "OFFEN" && (
                  <div className="row">
                    <input
                      placeholder="Entscheidungsnotiz"
                      value={decisionByReport[r.id] || ""}
                      onChange={(e) =>
                        setDecisionByReport((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                    <button onClick={() => resolve(r.id)}>Als bearbeitet markieren</button>
                  </div>
                )}
                {r.decisionNote && <p>Notiz: {r.decisionNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Bewertungen prüfen</h2>
        <select value={selectedRating} onChange={(e) => setSelectedRating(e.target.value)}>
          <option value="">Bewertung auswählen</option>
          {ratings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} | Score {r.score} | {r.status}
            </option>
          ))}
        </select>
        <button onClick={moderateRating} className="ghost">
          Bewertung moderieren
        </button>
      </div>
    </section>
  );
}
