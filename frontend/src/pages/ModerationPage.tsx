import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

export function ModerationPage({ token }: Props) {
  const { pushToast } = useToast();
  const [reports, setReports] = useState<Array<{ id: string; reason: string; details?: string; status: string }>>([]);
  const [ratings, setRatings] = useState<Array<{ id: string; score: number; comment?: string; createdAt: string; fromUser?: { name?: string } }>>([]);

  const loadData = async () => {
    if (!token) return;
    try {
      const [nextReports, nextRatings] = await Promise.all([api.listReports(token), api.getRatingsReceived(token)]);
      setReports(nextReports);
      setRatings(nextRatings);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Moderationsdaten konnten nicht geladen werden.", "error");
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData();
  }, [token]);

  const resolve = async (id: string) => {
    if (!token) return;
    try {
      await api.updateReportStatus(id, "RESOLVED", token);
      await loadData();
      pushToast("Meldung als bearbeitet markiert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Report konnte nicht aktualisiert werden.", "error");
    }
  };

  if (!token) {
    return (
      <section className="stack">
        <h1>Moderation</h1>
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
      <h1>Moderation</h1>
      <Surface title="Meldungen">
        {reports.length === 0 ? (
          <EmptyState title="Keine Meldungen" text="Aktuell warten keine Meldungen auf Bearbeitung." />
        ) : (
          <ul>
            {reports.map((r) => (
              <li key={r.id} className="inbox-item">
                <p>
                  <strong>Report</strong> | {r.reason} | Status: <StatusPill label={r.status} tone={r.status === "RESOLVED" ? "success" : "warning"} />
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
      </Surface>

      <Surface title="Bewertungen (eingehend)">
        {ratings.length === 0 ? (
          <EmptyState title="Keine Bewertungen" text="Es sind derzeit keine eingehenden Bewertungen vorhanden." />
        ) : (
          <ul className="meta-list">
            {ratings.map((r) => (
              <li key={r.id}>
                {new Date(r.createdAt).toLocaleString()} | Score {r.score} | von {r.fromUser?.name ?? "Unbekannt"}
                {r.comment ? ` | "${r.comment}"` : ""}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </section>
  );
}
