import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api, type ModerationReport } from "../services/api";
import { useModalFocus } from "../hooks/useModalFocus";

type Props = {
  token?: string;
};

type DialogMode = "warn" | "suspend" | "delete" | null;

const targetTypeLabel: Record<ModerationReport["targetType"], string> = {
  TOOL: "Werkzeug",
  WORKSHOP: "Werkstatt",
  USER: "Nutzer",
  RATING: "Bewertung"
};

const statusPresentation: Record<
  ModerationReport["status"],
  { label: string; tone: "warning" | "success" | "danger" | "neutral" }
> = {
  OPEN: { label: "Offen", tone: "warning" },
  IN_REVIEW: { label: "In Bearbeitung", tone: "warning" },
  RESOLVED: { label: "Erledigt", tone: "success" },
  REJECTED: { label: "Verworfen", tone: "danger" }
};

function formatWhen(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString("de-DE");
}

function ReportSummary({ report, showDecision }: { report: ModerationReport; showDecision?: boolean }) {
  const status = statusPresentation[report.status];

  return (
    <>
      <div className="moderation-report-head">
        <StatusPill label={status.label} tone={status.tone} />
        <span className="moderation-report-meta">
          Gemeldet {formatWhen(report.createdAt)} · von {report.reporterName}
        </span>
      </div>

      <p>
        <strong>{targetTypeLabel[report.targetType]}:</strong>{" "}
        {report.targetHref ? (
          <Link to={report.targetHref} className="moderation-target-link">
            {report.targetLabel}
          </Link>
        ) : (
          report.targetLabel
        )}
      </p>

      {report.subjectUserName && (
        <p className="hint">
          Betroffener Nutzer: <strong>{report.subjectUserName}</strong>
        </p>
      )}

      <p>
        <strong>Meldegrund:</strong> {report.reason}
      </p>
      {report.details && <p>{report.details}</p>}

      {report.ratingPreview && (
        <div className="moderation-rating-preview">
          <p>
            <strong>{report.ratingPreview.fromUserName}</strong> · {report.ratingPreview.score} von 5 Sternen
            {report.ratingPreview.listingLabel ? ` · ${report.ratingPreview.listingLabel}` : ""}
          </p>
          {report.ratingPreview.comment && <p className="moderation-rating-preview-comment">„{report.ratingPreview.comment}“</p>}
          <p className="hint">Bei Bestätigung wird die Bewertung ausgeblendet.</p>
        </div>
      )}

      {showDecision && (
        <div className="moderation-decision-box">
          <p>
            <strong>Entscheidung:</strong> {report.decisionNote?.trim() || "—"}
          </p>
          <p className="hint">
            {status.label} am {formatWhen(report.decisionAt) ?? "—"}
            {report.moderatorName ? ` · durch ${report.moderatorName}` : ""}
          </p>
        </div>
      )}

      {report.conversationContext && (
        <details>
          <summary>Chatverlauf (Kontext)</summary>
          <pre className="hint moderation-context">{report.conversationContext}</pre>
        </details>
      )}
    </>
  );
}

function ReportActions({
  report,
  token,
  onDone
}: {
  report: ModerationReport;
  token: string;
  onDone: () => Promise<void>;
}) {
  const { pushToast } = useToast();
  const [decisionNote, setDecisionNote] = useState("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [actionReason, setActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const closeDialog = useCallback(() => setDialogMode(null), []);
  useModalFocus(dialogRef, closeDialog, reasonRef, dialogMode !== null);

  const subjectId = report.subjectUserId;
  const canActOnUser = Boolean(subjectId);

  const runUpdate = async (payload: Parameters<typeof api.updateReportStatus>[1]) => {
    setBusy(true);
    try {
      await api.updateReportStatus(report.id, payload, token);
      await onDone();
      setDialogMode(null);
      setActionReason("");
      setDecisionNote("");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Aktion fehlgeschlagen.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = () => {
    const note = decisionNote.trim();
    if (note.length < 3) {
      return;
    }
    void runUpdate({ status: "REJECTED", decisionNote: note });
  };

  const submitDialog = (event: FormEvent) => {
    event.preventDefault();
    const reason = actionReason.trim();
    if (reason.length < 3) {
      return;
    }
    if (dialogMode !== "delete" && !subjectId) {
      pushToast("Kein betroffener Nutzer für diese Meldung gefunden.", "error");
      return;
    }

    const note = decisionNote.trim() || undefined;
    if (dialogMode === "warn") {
      void runUpdate({
        status: "RESOLVED",
        decisionNote: note,
        warnUserId: subjectId ?? undefined,
        warningReason: reason
      });
      return;
    }

    if (dialogMode === "suspend") {
      void runUpdate({
        status: "RESOLVED",
        decisionNote: note,
        requestSuspensionUserId: subjectId ?? undefined,
        suspensionReason: reason
      });
      return;
    }

    if (dialogMode === "delete") {
      void runUpdate({
        status: "RESOLVED",
        decisionNote: note,
        deleteTool: report.targetType === "TOOL",
        deleteWorkshop: report.targetType === "WORKSHOP",
        warningReason: reason
      });
    }
  };

  return (
    <div className="moderation-actions-block">
      <label className="field">
        <span>Interne Notiz / Entscheidung</span>
        <textarea
          value={decisionNote}
          onChange={(event) => setDecisionNote(event.target.value)}
          placeholder="Begründung beim Verwerfen (Pflicht)"
          rows={2}
        />
      </label>
      <div className="moderation-actions">
        <button type="button" className="btn secondary mini" disabled={busy} onClick={() => void reject()}>
          Verwerfen
        </button>
        <button
          type="button"
          className="btn mini"
          disabled={busy || !canActOnUser}
          title={canActOnUser ? undefined : "Kein Nutzerbezug für Ermahnung"}
          onClick={() => setDialogMode("warn")}
        >
          Nutzer ermahnen
        </button>
        <button
          type="button"
          className="btn mini"
          disabled={busy || !canActOnUser}
          title={canActOnUser ? undefined : "Kein Nutzerbezug für Sperranfrage"}
          onClick={() => setDialogMode("suspend")}
        >
          Sperrung anfordern
        </button>
        {report.targetType === "TOOL" && (
          <button
            type="button"
            className="btn danger mini"
            disabled={busy}
            onClick={() => setDialogMode("delete")}
          >
            Angebot löschen
          </button>
        )}
        {report.targetType === "WORKSHOP" && (
          <button
            type="button"
            className="btn danger mini"
            disabled={busy}
            onClick={() => setDialogMode("delete")}
          >
            Werkstatt löschen
          </button>
        )}
      </div>

      {dialogMode && (
        <div className="report-form-backdrop" role="presentation">
          <section
            ref={dialogRef}
            className="report-form-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-action-title"
            tabIndex={-1}
          >
            <header className="report-form-head">
              <h2 id="moderation-action-title">
                {dialogMode === "warn"
                  ? "Nutzer ermahnen"
                  : dialogMode === "suspend"
                    ? "Sperrung anfordern"
                    : report.targetType === "TOOL"
                      ? "Angebot löschen"
                      : "Werkstatt löschen"}
              </h2>
              <button type="button" className="icon-button" onClick={closeDialog} aria-label="Schließen">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <form className="stack" onSubmit={submitDialog}>
              <p className="hint">
                {dialogMode === "warn"
                  ? `Die Ermahnung wird an ${report.subjectUserName ?? "den Nutzer"} in der Inbox zugestellt.`
                  : dialogMode === "suspend"
                    ? `Der Admin erhält eine Anfrage zur Sperrung von ${report.subjectUserName ?? "dem Nutzer"}.`
                    : `Das Angebot/die Werkstatt wird unwiderruflich gelöscht und der Besitzer erhält eine Benachrichtigung.`}
              </p>
              <label className="field">
                <span>
                  {dialogMode === "warn"
                    ? "Begründung der Ermahnung"
                    : dialogMode === "suspend"
                      ? "Begründung der Sperranfrage"
                      : "Grund für das Herunternehmen"}
                </span>
                <textarea
                  ref={reasonRef}
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  required
                  minLength={3}
                  rows={4}
                  placeholder={
                    dialogMode === "delete"
                      ? "Warum wird dieses Angebot/diese Werkstatt gelöscht?"
                      : "Was ist passiert und warum ist diese Maßnahme angemessen?"
                  }
                />
              </label>
              <div className="row">
                <button type="button" className="btn secondary" onClick={closeDialog} disabled={busy}>
                  Abbrechen
                </button>
                <button type="submit" className={dialogMode === "delete" ? "btn danger" : "btn"} disabled={busy}>
                  {dialogMode === "warn"
                    ? "Ermahnung senden"
                    : dialogMode === "suspend"
                      ? "Sperrung anfordern"
                      : report.targetType === "TOOL"
                        ? "Angebot unwiderruflich löschen"
                        : "Werkstatt unwiderruflich löschen"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export function ModerationPage({ token }: Props) {
  const { pushToast } = useToast();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [closedReports, setClosedReports] = useState<ModerationReport[]>([]);
  const [archiveLimit, setArchiveLimit] = useState<number | "all">(10);

  const loadData = async () => {
    if (!token) return;
    try {
      const [nextReports, nextClosedReports] = await Promise.all([
        api.listReports(token),
        api.listClosedReports(token)
      ]);
      setReports(nextReports);
      setClosedReports(nextClosedReports);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Moderationsdaten konnten nicht geladen werden.", "error");
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const rejectedCount = closedReports.filter((r) => r.status === "REJECTED").length;
  const displayedReports = archiveLimit === "all" ? closedReports : closedReports.slice(0, archiveLimit);

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
      <p className="hint">
        Offene Meldungen prüfen, Ziel ansehen, verwerfen oder mit Ermahnung bzw. Sperranfrage abschließen.
      </p>

      <Surface title="Offene Meldungen" subtitle="Verwerfen = unbegründet. Ermahnen oder Sperrung = bestätigt mit Folge.">
        {reports.length === 0 ? (
          <EmptyState title="Keine offenen Meldungen" text="Aktuell warten keine Meldungen auf Bearbeitung." />
        ) : (
          <ul className="moderation-report-list">
            {reports.map((report) => (
              <li key={report.id} className="inbox-item moderation-report">
                <ReportSummary report={report} />
                <ReportActions report={report} token={token} onDone={loadData} />
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface title="Archiv" subtitle="Abgeschlossene Meldungen mit dokumentierter Entscheidung.">
        <details className="moderation-archive">
          <summary>
            Abgeschlossene Meldungen anzeigen ({closedReports.length}
            {rejectedCount > 0 ? `, davon ${rejectedCount} verworfen` : ""})
          </summary>
          {closedReports.length === 0 ? (
            <p className="hint moderation-archive-empty">Noch keine abgeschlossenen Meldungen vorhanden.</p>
          ) : (
            <>
              <div className="row archive-limit-row" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <span className="hint">Einträge anzeigen:</span>
                <select
                  value={archiveLimit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setArchiveLimit(val === "all" ? "all" : Number(val));
                  }}
                  style={{ width: "auto", padding: "0.25rem 0.5rem" }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value="all">Alle</option>
                </select>
              </div>
              <ul className="moderation-report-list">
                {displayedReports.map((report) => (
                  <li
                    key={report.id}
                    className={`inbox-item moderation-report moderation-report--closed${report.status === "REJECTED" ? " moderation-report--rejected" : ""}`}
                  >
                    <ReportSummary report={report} showDecision />
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      </Surface>
    </section>
  );
}
