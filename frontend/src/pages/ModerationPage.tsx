import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
};

export function ModerationPage({ token }: Props) {
  const [reports, setReports] = useState<Array<{ id: string; reason: string; details?: string; status: string }>>([]);
  const [ratings, setRatings] = useState<Array<{ id: string; score: number; comment?: string; createdAt: string; fromUser?: { name?: string } }>>([]);

  const loadData = async () => {
    try {
      const [nextReports, nextRatings] = await Promise.all([api.listReports(token), api.getRatingsReceived(token)]);
      setReports(nextReports);
      setRatings(nextRatings);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Moderationsdaten konnten nicht geladen werden.");
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const resolve = async (id: string) => {
    try {
      await api.updateReportStatus(id, "RESOLVED", token);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Report konnte nicht aktualisiert werden.");
    }
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
                  <strong>Report</strong> | {r.reason} | Status: {r.status}
                </p>
                {r.details && <p>{r.details}</p>}
                {(r.status === "OPEN" || r.status === "IN_REVIEW") && (
                  <div className="row">
                    <button onClick={() => void resolve(r.id)}>Als bearbeitet markieren</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Bewertungen (eingehend)</h2>
        {ratings.length === 0 ? (
          <p>Keine Bewertungen vorhanden.</p>
        ) : (
          <ul>
          {ratings.map((r) => (
            <li key={r.id}>
              {new Date(r.createdAt).toLocaleString()} | Score {r.score} | von {r.fromUser?.name ?? "Unbekannt"}
              {r.comment ? ` | "${r.comment}"` : ""}
            </li>
          ))}
          </ul>
        )}
      </div>
    </section>
  );
}
