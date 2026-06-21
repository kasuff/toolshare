import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DateInput } from "../components/DateInput";
import { DetailTopBar } from "../components/DetailTopBar";
import { RatingsSection } from "../components/RatingsSection";
import { ReportFormPanel } from "../components/ReportFormPanel";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { DEFAULT_PLACEHOLDER_IMAGE, getPlaceholderImageForCategory, TOOL_CATEGORIES } from "../utils/categories";
import { useModalFocus } from "../hooks/useModalFocus";
import type { PublicRating, Tool, User } from "../types/domain";

type Props = {
  token?: string;
  currentUser?: User;
};

type CalendarDay = {
  key: string;
  day: number | null;
  dateKey?: string;
  available: boolean;
};

type BlockingPeriod = {
  startIso: string;
  endIso: string;
};

type OwnerBlock = {
  id: string;
  startIso: string;
  endIso: string;
};

const BLOCK_RANGE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function formatBlockRange(block: OwnerBlock) {
  return `${BLOCK_RANGE_FORMAT.format(new Date(block.startIso))} – ${BLOCK_RANGE_FORMAT.format(
    new Date(block.endIso)
  )}`;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startDate: toLocalDateKey(start), endDate: toLocalDateKey(end) };
}

function overlapsDay(period: BlockingPeriod, date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return new Date(period.startIso) < dayEnd && new Date(period.endIso) > dayStart;
}

function periodsOverlap(startIso: string, endIso: string, periods: BlockingPeriod[]) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return periods.some(
    (period) => new Date(period.startIso) < end && new Date(period.endIso) > start
  );
}

function getCalendarDays(
  monthDate: Date,
  isAvailable: boolean,
  blockingPeriods: BlockingPeriod[]
): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toLocalDateKey(new Date());
  const days: CalendarDay[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    days.push({ key: `empty-${index}`, day: null, available: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = toLocalDateKey(new Date(year, month, day));
    days.push({
      key: dateKey,
      day,
      dateKey,
      available:
        isAvailable &&
        dateKey > today &&
        !blockingPeriods.some((period) => overlapsDay(period, new Date(year, month, day)))
    });
  }

  return days;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ToolDetailPage({ token, currentUser }: Props) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const defaults = useMemo(getDefaultDates, []);

  const [tool, setTool] = useState<Tool | null>(null);
  const [blockingPeriods, setBlockingPeriods] = useState<BlockingPeriod[]>([]);
  const [ownerBlocks, setOwnerBlocks] = useState<OwnerBlock[]>([]);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [endTime, setEndTime] = useState("10:00");
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [isSelectingRangeEnd, setIsSelectingRangeEnd] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [ratings, setRatings] = useState<PublicRating[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const imageViewerRef = useRef<HTMLDivElement>(null);
  const imageViewerCloseRef = useRef<HTMLButtonElement>(null);
  const closeImageViewer = useCallback(() => setIsImageOpen(false), []);
  useModalFocus(imageViewerRef, closeImageViewer, imageViewerCloseRef, isImageOpen);

  useEffect(() => {
    const loadTool = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [tools, periods, toolRatings] = await Promise.all([
          api.getTools({}, token ?? ""),
          api.getToolBlockingPeriods(id),
          api.getRatingsForTool(id)
        ]);
        const foundTool = tools.find((entry) => entry.id === id);
        if (foundTool) {
          setTool(foundTool);
          setBlockingPeriods(periods);
          setRatings(toolRatings);
          if (token && currentUser?.id === foundTool.ownerId) {
            try {
              setOwnerBlocks(await api.getToolOwnerBlocks(id, token));
            } catch {
              setOwnerBlocks([]);
            }
          } else {
            setOwnerBlocks([]);
          }
        } else {
          pushToast("Werkzeug nicht gefunden.", "error");
          navigate("/tools");
        }
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht geladen werden.", "error");
        navigate("/tools");
      } finally {
        setIsLoading(false);
      }
    };
    void loadTool();
  }, [id, token, navigate, pushToast, currentUser?.id]);

  const isAvailable = tool?.status === "VERFUEGBAR";
  const isOwnTool = Boolean(tool && currentUser?.id === tool.ownerId);
  const isManageMode = isOwnTool && searchParams.get("manage") === "1";
  const canChooseDates = isOwnTool || isAvailable;
  const toolImage = tool ? tool.imageUrl || getPlaceholderImageForCategory(tool.category) : "";
  const hasUploadedImage = Boolean(tool?.imageUrl && tool.imageUrl !== DEFAULT_PLACEHOLDER_IMAGE);
  const categoryLabel = tool
    ? TOOL_CATEGORIES.find((category) => category.value === tool.category.toLowerCase())?.label ?? tool.category
    : "";

  const calendarMonths = useMemo(() => {
    const firstMonth = new Date();
    firstMonth.setDate(1);
    firstMonth.setMonth(firstMonth.getMonth() + calendarMonthOffset);
    return [0, 1].map((monthIndex) => {
      const monthDate = new Date(firstMonth);
      monthDate.setMonth(monthDate.getMonth() + monthIndex);
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(monthDate),
        days: getCalendarDays(monthDate, canChooseDates, blockingPeriods)
      };
    });
  }, [blockingPeriods, calendarMonthOffset, canChooseDates]);

  const selectCalendarDate = (dateKey: string) => {
    if (!isSelectingRangeEnd || dateKey < startDate) {
      setStartDate(dateKey);
      setEndDate(dateKey);
      setIsSelectingRangeEnd(true);
      return;
    }
    setEndDate(dateKey);
    setIsSelectingRangeEnd(false);
  };

  const openToolImage = () => {
    if (!hasUploadedImage) {
      pushToast("Keine Bilder vorhanden.", "info");
      return;
    }
    setIsImageOpen(true);
  };

  const requestTool = async () => {
    if (!tool) return;
    if (!startDate || !startTime || !endDate || !endTime) {
      return;
    }
    if (!token) {
      navigate("/auth", { state: { redirectHint: "Bitte melde dich an, um eine Ausleihe anzufragen." } });
      return;
    }

    setIsSubmitting(true);
    try {
      const startIso = `${startDate}T${startTime}`;
      const endIso = `${endDate}T${endTime}`;
      if (new Date(endIso) <= new Date(startIso)) {
        throw new Error("Der gewählte Zeitraum ist ungültig. Bitte eine spätere Abgabe wählen.");
      }

      const createdBooking = await api.createToolRequest(
        {
          toolId: tool.id,
          startIso,
          endIso,
          pickupTimeIso: startIso
        },
        token
      );
      pushToast("Ausleihanfrage erstellt.", "success");
      navigate("/inbox", { state: { bookingId: createdBooking.id } });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Anfrage konnte nicht erstellt werden.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const blockToolForOwnUse = async () => {
    if (!tool || !token) return;
    if (!startDate || !startTime || !endDate || !endTime) {
      return;
    }
    const startIso = `${startDate}T${startTime}`;
    const endIso = `${endDate}T${endTime}`;
    if (new Date(endIso) <= new Date(startIso)) {
      pushToast("Das Ende muss nach dem Beginn liegen.", "error");
      return;
    }
    if (periodsOverlap(startIso, endIso, blockingPeriods)) {
      pushToast("Im gewählten Zeitraum ist bereits eine angenommene oder offene Buchung vorhanden.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createToolOwnerBlock({ toolId: tool.id, startIso, endIso }, token);
      setBlockingPeriods((current) => [...current, { startIso, endIso }]);
      // Liste der eigenen Blockaden aktualisieren, damit die neue Blockade entfernbar ist.
      try {
        setOwnerBlocks(await api.getToolOwnerBlocks(tool.id, token));
      } catch {
        /* Liste bleibt unverändert, falls das Nachladen fehlschlägt */
      }
      pushToast("Werkzeug wurde für deinen Eigenbedarf blockiert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht blockiert werden.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeOwnerBlock = async (block: OwnerBlock) => {
    if (!tool || !token) return;
    setDeletingBlockId(block.id);
    try {
      await api.deleteToolOwnerBlock(tool.id, block.id, token);
      setOwnerBlocks((current) => current.filter((entry) => entry.id !== block.id));
      // Kalender-Sperrzeiten frisch laden, damit der freigegebene Zeitraum wieder buchbar ist.
      try {
        setBlockingPeriods(await api.getToolBlockingPeriods(tool.id));
      } catch {
        /* Sperrzeiten bleiben unverändert, falls das Nachladen fehlschlägt */
      }
      pushToast("Blockierung wurde aufgehoben.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Blockierung konnte nicht aufgehoben werden.", "error");
    } finally {
      setDeletingBlockId(null);
    }
  };

  const deleteTool = async () => {
    if (!tool || !token) return;
    setIsDeleting(true);
    try {
      await api.deleteTool(tool.id, token);
      pushToast("Werkzeug endgültig gelöscht.", "success");
      navigate("/offers");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Werkzeug konnte nicht gelöscht werden.", "error");
      setIsDeleting(false);
    }
  };

  const closeReportForm = () => {
    setShowReportForm(false);
    setReportReason("");
    setReportDetails("");
  };

  const openReportForm = () => {
    if (!token) {
      navigate("/auth", { state: { redirectHint: "Bitte melde dich an, um ein Angebot zu melden." } });
      return;
    }
    setShowReportForm(true);
  };

  const reportTool = async () => {
    if (!tool) return;
    if (reportReason.trim().length < 5) {
      return;
    }
    setIsReporting(true);
    try {
      await api.createReport(
        {
          targetType: "TOOL",
          targetId: tool.id,
          reason: reportReason.trim(),
          details: reportDetails.trim() || undefined
        },
        token!
      );
      closeReportForm();
      pushToast("Meldung wurde erfasst.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Meldung konnte nicht gesendet werden.", "error");
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading) {
    return <section className="stack"><p>Laden...</p></section>;
  }

  if (!tool) {
    return <section className="stack"><p>Werkzeug nicht gefunden.</p></section>;
  }

  const providerName = tool.ownerName ?? "Unbekannt";

  return (
    <section className="tool-detail-page" aria-label={tool.name}>
      <DetailTopBar onBack={() => navigate(isManageMode ? "/offers" : "/tools")}>
        <button type="button" className="detail-report-trigger" onClick={openReportForm}>
          Werkzeug melden
        </button>
      </DetailTopBar>

      {showReportForm && (
        <ReportFormPanel
          title="Werkzeug melden"
          hint="Melde unangemessene Inhalte an die Moderation."
          reason={reportReason}
          details={reportDetails}
          isSubmitting={isReporting}
          submitLabel="Werkzeug melden"
          onReasonChange={setReportReason}
          onDetailsChange={setReportDetails}
          onSubmit={() => void reportTool()}
          onCancel={closeReportForm}
        />
      )}

      <button
        type="button"
        className="tool-detail-image"
        onClick={openToolImage}
        aria-label={hasUploadedImage ? `${tool.name} vergrößern` : "Keine Bilder vorhanden"}
      >
        <img src={toolImage} alt={tool.name} />
      </button>

      <div className="tool-detail-layout">
        <div className="tool-detail-main">
          <header className="tool-detail-header">
            <h1>{tool.name}</h1>
            <span className="tool-detail-category">{categoryLabel}</span>
          </header>

          <section className="workshop-detail-section">
            <h2>Details</h2>
            <p>{tool.description}</p>
          </section>

          <section className="workshop-detail-section">
            <h2>Adresse</h2>
            <p>{tool.pickupLocation || "Kein Abholort angegeben"}</p>
            {tool.pickupLocationNote && <p className="tool-location-note">{tool.pickupLocationNote}</p>}
          </section>

          <section className="workshop-detail-section">
            <h2>Anbieter</h2>
            <div className="workshop-detail-provider">
              <span className="ds-workshop-card-avatar">{getInitials(providerName)}</span>
              <div>
                <strong>{providerName}</strong>
                <span>Werkzeuganbieter</span>
              </div>
            </div>
          </section>

          <section className="workshop-detail-section">
            <div className="workshop-calendar-toolbar">
              <h2>Verfügbare Tage</h2>
              <div className="workshop-calendar-navigation">
                <button
                  type="button"
                  aria-label="Vorherige Monate"
                  title="Vorherige Monate"
                  disabled={calendarMonthOffset === 0}
                  onClick={() => setCalendarMonthOffset((offset) => Math.max(0, offset - 1))}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                  type="button"
                  aria-label="Nächste Monate"
                  title="Nächste Monate"
                  onClick={() => setCalendarMonthOffset((offset) => offset + 1)}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            <p className="workshop-calendar-instruction">
              {canChooseDates
                ? isSelectingRangeEnd
                  ? "Wähle jetzt den letzten Tag des Zeitraums."
                  : "Wähle den ersten Tag des gewünschten Zeitraums."
                : "Dieses Werkzeug ist aktuell nicht verfügbar."}
            </p>
            <div className="workshop-calendar-months">
              {calendarMonths.map((month) => (
                <div key={month.key} className="workshop-calendar-month">
                  <h3>{month.label}</h3>
                  <div className="workshop-calendar" aria-label={`Verfügbare Tage im ${month.label}`}>
                    {WEEKDAYS.map((weekday) => (
                      <span key={weekday} className="workshop-calendar-weekday">{weekday}</span>
                    ))}
                    {month.days.map((day) => {
                      const dateKey = day.dateKey ?? "";
                      const isRangeStart = dateKey === startDate;
                      const isRangeEnd = dateKey === endDate;
                      const isInRange = Boolean(dateKey && dateKey >= startDate && dateKey <= endDate);
                      return day.day === null ? (
                        <span key={day.key} className="workshop-calendar-day empty" />
                      ) : (
                        <button
                          key={day.key}
                          type="button"
                          className={`workshop-calendar-day ${day.available ? "available" : "unavailable"} ${
                            isInRange ? "in-range" : ""
                          } ${isRangeStart ? "range-start" : ""} ${isRangeEnd ? "range-end" : ""}`.trim()}
                          disabled={!day.available}
                          onClick={() => selectCalendarDate(dateKey)}
                        >
                          {day.day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="workshop-calendar-legend">
              <span><i className="available" /> Verfügbar</span>
              <span><i className="unavailable" /> Nicht verfügbar</span>
            </div>
          </section>

          <RatingsSection ratings={ratings} token={token} canReport={!isOwnTool} />
        </div>

        <aside className={`playtomic-booking-panel tool-detail-booking ${!canChooseDates ? "unavailable" : ""}`.trim()}>
          <h2>{isOwnTool ? "Werkzeug für Eigenbedarf blockieren" : "Werkzeug buchen"}</h2>
          {canChooseDates ? (
            <>
              <div className="booking-section">
                <div className="booking-section-title">
                  <span />
                  <strong>{isOwnTool ? "Beginn des Eigenbedarfs" : "Abholdaten"}</strong>
                </div>
                <div className="booking-fields-row">
                  <div className="booking-field">
                    <span>Datum</span>
                    <DateInput
                      aria-label={isOwnTool ? "Startdatum Eigenbedarf" : "Abholdatum"}
                      value={startDate}
                      min={defaults.startDate}
                      onChange={setStartDate}
                      className="booking-input"
                    />
                  </div>
                  <label>
                    <span>Uhrzeit</span>
                    <input
                      aria-label={isOwnTool ? "Startzeit Eigenbedarf" : "Abholzeit"}
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className="booking-input"
                    />
                  </label>
                </div>
              </div>

              <div className="booking-divider" />

              <div className="booking-section">
                <div className="booking-section-title">
                  <span />
                  <strong>{isOwnTool ? "Ende des Eigenbedarfs" : "Abgabedaten"}</strong>
                </div>
                <div className="booking-fields-row">
                  <div className="booking-field">
                    <span>Datum</span>
                    <DateInput
                      aria-label={isOwnTool ? "Enddatum Eigenbedarf" : "Abgabedatum"}
                      value={endDate}
                      min={startDate}
                      onChange={setEndDate}
                      className="booking-input"
                    />
                  </div>
                  <label>
                    <span>Uhrzeit</span>
                    <input
                      aria-label={isOwnTool ? "Endzeit Eigenbedarf" : "Abgabezeit"}
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="booking-input"
                    />
                  </label>
                </div>
              </div>

              <div className="booking-actions">
                {isOwnTool ? (
                  <button
                    className="booking-button"
                    onClick={() => void blockToolForOwnUse()}
                    disabled={isSubmitting}
                    aria-label={`Zeitraum für ${tool.name} blockieren`}
                  >
                    {isSubmitting ? "Wird blockiert..." : "Zeitraum blockieren"}
                  </button>
                ) : token ? (
                  <button className="booking-button" onClick={() => void requestTool()} disabled={isSubmitting}>
                    {isSubmitting ? "Wird versendet..." : "Anfrage senden"}
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    state={{ redirectHint: "Bitte melde dich an, um eine Ausleihe anzufragen." }}
                    className="booking-button"
                  >
                    Jetzt einloggen
                  </Link>
                )}
                <p className="booking-hint">
                  {isOwnTool
                    ? "Die Blockierung gilt sofort und erzeugt keine Nachricht."
                    : "Der Anbieter muss deine Anfrage noch bestätigen."}
                </p>
              </div>

              {isOwnTool && ownerBlocks.length > 0 && (
                <div className="booking-section owner-blocks">
                  <div className="booking-section-title">
                    <span />
                    <strong>Deine blockierten Zeiträume</strong>
                  </div>
                  <ul className="owner-blocks-list">
                    {ownerBlocks.map((block) => (
                      <li key={block.id} className="owner-blocks-item">
                        <span className="owner-blocks-range">{formatBlockRange(block)}</span>
                        <button
                          type="button"
                          className="owner-blocks-remove"
                          onClick={() => void removeOwnerBlock(block)}
                          disabled={deletingBlockId === block.id}
                          aria-label="Blockierung aufheben"
                        >
                          {deletingBlockId === block.id ? "Wird entfernt..." : "Entfernen"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <p><strong>Dieses Werkzeug ist derzeit ausgeliehen.</strong></p>
              <p className="booking-hint">Nach der Rückgabe kann es wieder angefragt werden.</p>
            </>
          )}
        </aside>
      </div>

      {isManageMode && (
        <div className="owner-detail-actions">
          <Link className="btn secondary" to={`/tools/${tool.id}/edit`}>
            Werkzeug bearbeiten
          </Link>
          <button type="button" className="btn danger" onClick={() => setShowDeleteDialog(true)}>
            Werkzeug löschen
          </button>
        </div>
      )}

      {showDeleteDialog && (
        <ConfirmDialog
          title="Werkzeug endgültig löschen?"
          text={`„${tool.name}“ und die zugehörigen Angebotsdaten werden dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel="Werkzeug endgültig löschen"
          isBusy={isDeleting}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={() => void deleteTool()}
        />
      )}

      {isImageOpen && (
        <div
          ref={imageViewerRef}
          className="workshop-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Bild von ${tool.name}`}
          tabIndex={-1}
        >
          <button
            ref={imageViewerCloseRef}
            type="button"
            className="workshop-image-viewer-close"
            aria-label="Bildansicht schließen"
            title="Schließen"
            onClick={closeImageViewer}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="workshop-image-viewer-content">
            <img src={toolImage} alt={tool.name} />
          </div>
        </div>
      )}
    </section>
  );
}
