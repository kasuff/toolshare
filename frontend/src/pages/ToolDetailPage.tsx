import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { DetailTopBar } from "../components/DetailTopBar";
import { RatingsSection } from "../components/RatingsSection";
import { ReportFormPanel } from "../components/ReportFormPanel";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { DEFAULT_PLACEHOLDER_IMAGE, getPlaceholderImageForCategory, TOOL_CATEGORIES } from "../utils/categories";
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

function getCalendarDays(monthDate: Date, isAvailable: boolean): CalendarDay[] {
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
      available: isAvailable && dateKey > today
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
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const defaults = useMemo(getDefaultDates, []);

  const [tool, setTool] = useState<Tool | null>(null);
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

  useEffect(() => {
    const loadTool = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [tools, toolRatings] = await Promise.all([
          api.getTools({}, token ?? ""),
          api.getRatingsForTool(id)
        ]);
        const foundTool = tools.find((entry) => entry.id === id);
        if (foundTool) {
          setTool(foundTool);
          setRatings(toolRatings);
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
  }, [id, token, navigate, pushToast]);

  const isAvailable = tool?.status === "VERFUEGBAR";
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
        days: getCalendarDays(monthDate, isAvailable)
      };
    });
  }, [calendarMonthOffset, isAvailable]);

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
      pushToast("Bitte Abhol- und Abgabedaten vollständig ausfüllen.", "error");
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
      pushToast("Bitte gib einen Grund mit mindestens 5 Zeichen an.", "error");
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

  const isOwnTool = currentUser?.id === tool.ownerId;
  const providerName = tool.ownerName ?? "Unbekannt";

  return (
    <section className="tool-detail-page" aria-label={tool.name}>
      <DetailTopBar onBack={() => navigate("/tools")}>
        {!isOwnTool && (
          <button type="button" className="detail-report-trigger" onClick={openReportForm}>
            Werkzeug melden
          </button>
        )}
      </DetailTopBar>

      {showReportForm && !isOwnTool && (
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
              {isAvailable
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

        <aside className={`playtomic-booking-panel tool-detail-booking ${!isAvailable ? "unavailable" : ""}`.trim()}>
          <h2>Werkzeug buchen</h2>
          {isAvailable ? (
            <>
              <div className="booking-section">
                <div className="booking-section-title"><span /><strong>Abholdaten</strong></div>
                <div className="booking-fields-row">
                  <label>
                    <span>Datum</span>
                    <input
                      aria-label="Abholdatum"
                      type="date"
                      value={startDate}
                      min={defaults.startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="booking-input"
                    />
                  </label>
                  <label>
                    <span>Uhrzeit</span>
                    <input
                      aria-label="Abholzeit"
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
                <div className="booking-section-title"><span /><strong>Abgabedaten</strong></div>
                <div className="booking-fields-row">
                  <label>
                    <span>Datum</span>
                    <input
                      aria-label="Abgabedatum"
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="booking-input"
                    />
                  </label>
                  <label>
                    <span>Uhrzeit</span>
                    <input
                      aria-label="Abgabezeit"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      className="booking-input"
                    />
                  </label>
                </div>
              </div>

              <div className="booking-actions">
                {token ? (
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
                <p className="booking-hint">Der Anbieter muss deine Anfrage noch bestätigen.</p>
              </div>
            </>
          ) : (
            <>
              <p><strong>Dieses Werkzeug ist derzeit ausgeliehen.</strong></p>
              <p className="booking-hint">Nach der Rückgabe kann es wieder angefragt werden.</p>
            </>
          )}
        </aside>
      </div>

      {isImageOpen && (
        <div
          className="workshop-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Bild von ${tool.name}`}
          onClick={() => setIsImageOpen(false)}
        >
          <button
            type="button"
            className="workshop-image-viewer-close"
            aria-label="Bildansicht schließen"
            title="Schließen"
            onClick={() => setIsImageOpen(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="workshop-image-viewer-content" onClick={(event) => event.stopPropagation()}>
            <img src={toolImage} alt={tool.name} />
          </div>
        </div>
      )}
    </section>
  );
}
