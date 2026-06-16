import { useState } from "react";
import { ReportFormPanel } from "./ReportFormPanel";
import { EmptyState, Surface } from "./ui";
import { StarRatingDisplay } from "./StarRatingInput";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import type { PublicRating } from "../types/domain";

type Props = {
  title?: string;
  ratings: PublicRating[];
  token?: string;
  canReport?: boolean;
  emptyText?: string;
};

function averageScore(ratings: PublicRating[]) {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((total, rating) => total + rating.score, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function RatingsSection({
  title = "Bewertungen",
  ratings,
  token,
  canReport = true,
  emptyText = "Noch keine Bewertungen vorhanden."
}: Props) {
  const { pushToast } = useToast();
  const [reportRatingId, setReportRatingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const avg = averageScore(ratings);

  const submitReport = async () => {
    if (!token || !reportRatingId) return;
    if (reportReason.trim().length < 5) {
      pushToast("Bitte gib einen Grund mit mindestens 5 Zeichen an.", "error");
      return;
    }
    setIsReporting(true);
    try {
      await api.createReport(
        {
          targetType: "RATING",
          targetId: reportRatingId,
          reason: reportReason.trim(),
          details: reportDetails.trim() || undefined
        },
        token
      );
      setReportRatingId(null);
      setReportReason("");
      setReportDetails("");
      pushToast("Bewertung wurde gemeldet.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Meldung fehlgeschlagen.", "error");
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <>
      <Surface
        title={title}
        subtitle={ratings.length > 0 ? `${ratings.length} Bewertung${ratings.length === 1 ? "" : "en"}` : undefined}
        className="ratings-section"
      >
        {ratings.length === 0 ? (
          <EmptyState title="Keine Bewertungen" text={emptyText} />
        ) : (
          <>
            <div className="ratings-summary">
              <StarRatingDisplay score={Math.round(avg)} label={`Durchschnitt ${avg} von 5`} />
              <span className="ratings-summary-meta">
                {avg.toFixed(1).replace(".0", "")} / 5
              </span>
            </div>
            <ul className="ratings-list">
              {ratings.map((rating) => (
                <li key={rating.id} className="ratings-list-item">
                  <div className="ratings-list-head">
                    <StarRatingDisplay score={rating.score} />
                    <span className="ratings-list-meta">
                      {rating.fromUserName ?? "Nutzer"} · {new Date(rating.createdIso).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  {rating.comment && <p className="ratings-list-comment">{rating.comment}</p>}
                  {canReport && token && (
                    <button
                      type="button"
                      className="btn ghost ratings-report-button"
                      onClick={() => setReportRatingId(rating.id)}
                    >
                      Bewertung melden
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Surface>

      {reportRatingId && (
        <ReportFormPanel
          title="Bewertung melden"
          hint="Die Meldung wird von Moderatoren geprüft."
          reason={reportReason}
          details={reportDetails}
          isSubmitting={isReporting}
          submitLabel="Bewertung melden"
          onReasonChange={setReportReason}
          onDetailsChange={setReportDetails}
          onSubmit={() => void submitReport()}
          onCancel={() => {
            setReportRatingId(null);
            setReportReason("");
            setReportDetails("");
          }}
        />
      )}
    </>
  );
}
