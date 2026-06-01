import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { getPlaceholderImageForCategory } from "../utils/categories";
import type { Tool, User } from "../types/domain";

type Props = {
  token?: string;
  currentUser?: User;
};

export function ToolDetailPage({ token, currentUser: _currentUser }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  
  const [tool, setTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [durationDays, setDurationDays] = useState(1);
  const [pickupTime, setPickupTime] = useState("10:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadTool = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const tools = await api.getTools({}, token ?? "");
        const foundTool = tools.find(t => t.id === id);
        if (foundTool) {
          setTool(foundTool);
          // Set default start date to tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setStartDate(tomorrow.toISOString().split("T")[0]);
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

  const getEndDate = () => {
    if (!startDate) return "";
    const start = new Date(startDate);
    start.setDate(start.getDate() + durationDays);
    return start.toISOString().split("T")[0];
  };

  const requestTool = async () => {
    if (!tool) return;
    
    if (!startDate || !pickupTime) {
      pushToast("Bitte Startdatum und Abholzeit ausfüllen.", "error");
      return;
    }
    if (!token) {
      navigate("/auth", {
        state: {
          redirectHint: "Bitte melde dich an, um eine Ausleihe anzufragen."
        }
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const startIso = `${startDate}T${startTime}`;
      const endDate = getEndDate();
      const endIso = `${endDate}T${startTime}`;
      const pickupTimeIso = `${startDate}T${pickupTime}`;

      const start = new Date(startIso);
      const end = new Date(endIso);
      const pickup = new Date(pickupTimeIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(pickup.getTime())) {
        throw new Error("Ungültiges Datum oder ungültige Uhrzeit.");
      }
      if (end <= start) {
        throw new Error("Der gewählte Zeitraum ist ungültig. Bitte Endzeit nach Startzeit wählen.");
      }
      if (pickup < start || pickup > end) {
        throw new Error("Die Abholzeit muss innerhalb des angefragten Zeitraums liegen.");
      }
      
      await api.createToolRequest(
        {
          toolId: tool.id,
          startIso,
          endIso,
          pickupTimeIso
        },
        token
      );
      pushToast("Ausleihanfrage erstellt.", "success");
      navigate("/inbox");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Anfrage konnte nicht erstellt werden.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <section className="stack"><p>Laden...</p></section>;
  }

  if (!tool) {
    return <section className="stack"><p>Werkzeug nicht gefunden.</p></section>;
  }

  const isAvailable = tool.status === "VERFUEGBAR";
  const endDate = getEndDate();

  return (
    <section className="stack tool-detail-page">
      {/* Back Button */}
      <button onClick={() => navigate("/tools")} className="back-button">
        ← Zurück
      </button>

      {/* Hero Image with Status */}
      <div className="tool-hero">
        <img src={tool.imageUrl || getPlaceholderImageForCategory(tool.category)} alt={tool.name} />
        <div className="tool-status-badge">
          <span className={`status-badge ${isAvailable ? "available" : "borrowed"}`}>
            {isAvailable ? "Verfügbar" : "Ausgeliehen"}
          </span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="tool-content-grid">
        {/* Left Column - Info */}
        <div className="tool-info-column">
          <div className="tool-header">
            <h1>{tool.name}</h1>
            <p className="tool-category">{tool.category}</p>
          </div>

          <p className="tool-description">{tool.description}</p>

          <div className="owner-card">
            <h3>Abholort</h3>
            <div className="owner-details">
              <div className="owner-info">
                <div className="owner-name">{tool.pickupLocation || "Nicht angegeben"}</div>
                {tool.pickupLocationNote && <div className="owner-meta">Hinweis: {tool.pickupLocationNote}</div>}
              </div>
            </div>
          </div>

          {/* Owner Card */}
          <div className="owner-card">
            <h3>Anbieter</h3>
            <div className="owner-details">
              <div className="owner-info">
                <div className="owner-name">Anbieter Details</div>
                <div className="owner-meta">API noch nicht verfügbar</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Booking */}
        <div className="tool-booking-column">
          {isAvailable && token ? (
            <div className="playtomic-booking-panel">
              <h2>Werkzeug buchen</h2>
              
              {/* Startdatum */}
              <div className="booking-section">
                <label htmlFor="start-date" className="booking-label">Von wann?</label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="booking-input"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="booking-input"
                  style={{ marginTop: "8px" }}
                />
              </div>

              {/* Dauer */}
              <div className="booking-section">
                <label className="booking-label">Wie lange?</label>
                <div className="duration-picker">
                  <button 
                    className="duration-btn"
                    onClick={() => setDurationDays(Math.max(1, durationDays - 1))}
                  >
                    −
                  </button>
                  <div className="duration-display">
                    <strong>{durationDays}</strong>
                    <span className="duration-label">{durationDays === 1 ? "Tag" : "Tage"}</span>
                  </div>
                  <button 
                    className="duration-btn"
                    onClick={() => setDurationDays(Math.min(14, durationDays + 1))}
                  >
                    +
                  </button>
                </div>
                {endDate && (
                  <p className="booking-end-date">
                    Rückgabe: <strong>{endDate}</strong>
                  </p>
                )}
              </div>

              {/* Abholzeit */}
              <div className="booking-section">
                <label htmlFor="pickup-time" className="booking-label">Abholzeit?</label>
                <input
                  id="pickup-time"
                  type="time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="booking-input"
                />
              </div>

              <button 
                className="booking-button" 
                onClick={() => void requestTool()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Wird versendet..." : "Anfrage senden"}
              </button>

              <p className="booking-hint">
                Der Anbieter muss deine Anfrage noch bestätigen.
              </p>
            </div>
          ) : isAvailable ? (
            <div className="playtomic-booking-panel">
              <h2>Werkzeug buchen</h2>
              <p className="booking-hint">
                <strong>Einloggen, um zu buchen</strong>
              </p>
              <Link
                to="/auth"
                state={{ redirectHint: "Bitte melde dich an, um eine Ausleihe anzufragen." }}
                className="booking-button"
              >
                Jetzt einloggen
              </Link>
            </div>
          ) : (
            <div className="playtomic-booking-panel unavailable">
              <h2>Werkzeug buchen</h2>
              <p><strong>Dieses Werkzeug ist derzeit ausgeliehen.</strong></p>
              <p className="booking-hint">
                Schau später noch mal vorbei oder kontaktiere den Anbieter.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
