import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { EmptyState, Field, SkeletonCards, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User, Workshop, WorkshopSlot } from "../types/domain";

type Props = {
  token?: string;
  currentUser?: User;
};

type WorkshopListItem = {
  workshop: Workshop;
  slots: WorkshopSlot[];
  tools: Array<{ id: string; name: string; selectable: boolean }>;
};

function formatWorkshopDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function WorkshopsPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [maxCapacityFilter, setMaxCapacityFilter] = useState(10);
  const [items, setItems] = useState<WorkshopListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopListItem | null>(null);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const workshops = await api.getWorkshops({ q }, token ?? "");
        const mapped = workshops.map(({ workshop, slots }) => ({
          workshop,
          slots,
          tools: []
        }));
        const filtered = toolFilter
          ? mapped.filter((item) => item.workshop.name.toLowerCase().includes(toolFilter.toLowerCase()))
          : mapped;
        setItems(filtered.filter((item) => item.workshop.maxCapacity <= maxCapacityFilter));
      } catch (error) {
        if (token) {
          pushToast(error instanceof Error ? error.message : "Werkstätten konnten nicht geladen werden.", "error");
        } else {
          setItems([]);
        }
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    };
    void run();
  }, [q, toolFilter, token, pushToast, maxCapacityFilter]);

  const openWorkshop = (workshop: WorkshopListItem) => {
    setSelectedWorkshop(workshop);
  };

  const closeWorkshop = () => {
    setSelectedWorkshop(null);
  };

  const bookWorkshop = async (workshopId: string, slotId: string) => {
    if (!token) {
      pushToast("Zum Buchen bitte anmelden.", "info");
      navigate("/auth", { state: { redirectHint: "Bitte melde dich an, um eine Werkstatt zu buchen." } });
      return;
    }
    try {
      await api.createWorkshopBooking({ slotId }, token);
      pushToast("Werkstattbuchung erstellt.", "success");
      if (selectedWorkshop?.workshop.id === workshopId) {
        closeWorkshop();
      }
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Buchung fehlgeschlagen.", "error");
    }
  };

  const ownedWorkshops = currentUser ? items.filter((item) => item.workshop.ownerId === currentUser.id) : [];
  const publicWorkshops = currentUser ? items.filter((item) => item.workshop.ownerId !== currentUser.id) : items;

  const ownedStats = currentUser
    ? [
        { label: "Eigene Werkstätten", value: ownedWorkshops.length },
        { label: "Zeitfenster", value: ownedWorkshops.reduce((sum, item) => sum + item.slots.length, 0) },
        {
          label: "Durchschn. Kapazität",
          value:
            ownedWorkshops.length > 0
              ? Math.round(ownedWorkshops.reduce((sum, item) => sum + item.workshop.maxCapacity, 0) / ownedWorkshops.length)
              : 0
        }
      ]
    : [];

  return (
    <section className="stack">
      <div className="page-header">
        <div className="stack">
          <h1>Werkstätten</h1>
          <p className="subtitle">Klicke auf eine Werkstatt, um Details und Buchungsfenster in einem Fenster zu sehen.</p>
        </div>
        {token && (
          <button className="btn" onClick={() => navigate("/workshops/new")}>
            <span className="material-symbols-outlined">add</span>
            Neue Werkstatt
          </button>
        )}
      </div>

      {currentUser && (
        <Surface title="Meine Werkstätten" subtitle="Eigene Räume und Verfügbarkeiten auf einen Blick.">
          {ownedWorkshops.length > 0 ? (
            <div className="workshop-dashboard">
              <div className="workshop-dashboard-stats">
                {ownedStats.map((stat) => (
                  <div key={stat.label} className="workshop-dashboard-stat">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>

              <div className="workshop-dashboard-grid">
                {ownedWorkshops.map((item) => (
                  <article
                    key={item.workshop.id}
                    className={`workshop-card ${selectedWorkshop?.workshop.id === item.workshop.id ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openWorkshop(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openWorkshop(item);
                      }
                    }}
                  >
                    <div className="workshop-card-media">
                      <img src={item.workshop.imageUrls[0]} alt={item.workshop.name} />
                      <span className="workshop-card-badge">Aktiv</span>
                    </div>
                    <div className="workshop-card-content">
                      <div className="workshop-card-heading">
                        <h3>{item.workshop.name}</h3>
                        <span className="workshop-card-rating">{item.slots.length} Slots</span>
                      </div>
                      <p>
                        {item.workshop.location} · {item.workshop.maxCapacity} Plätze
                      </p>
                      <div className="workshop-card-footer">
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate("/workshops/availability");
                          }}
                        >
                          Verfügbarkeit verwalten
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="Noch keine eigenen Werkstätten" text="Erstelle eine Werkstatt, um sie hier zu verwalten." />
          )}
        </Surface>
      )}

      <Surface title="Suche" className="interactive">
        <div className="filter-toolbar">
          <p className="result-summary">
            {isLoading ? "Suche läuft..." : `${items.length} Ergebnis${items.length === 1 ? "" : "se"}`}
          </p>
          {(q || toolFilter || maxCapacityFilter !== 10) && (
            <button
              className="btn secondary"
              onClick={() => {
                setQ("");
                setToolFilter("");
                setMaxCapacityFilter(10);
              }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
        <div className="grid grid-2">
          <Field label="Werkstattname oder Beschreibung">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche Werkstatt" />
          </Field>
          <Field label="Werkzeugfilter (Textmatch)">
            <input value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} placeholder="Werkzeugfilter" />
          </Field>
        </div>
        <div className="slider-row">
          <label htmlFor="capacity-slider">
            Maximale Kapazität bis: <strong>{maxCapacityFilter}</strong>
          </label>
          <input
            id="capacity-slider"
            type="range"
            min={1}
            max={20}
            value={maxCapacityFilter}
            onChange={(e) => setMaxCapacityFilter(Number(e.target.value))}
          />
        </div>
        <details>
          <summary>Erweiterte Filter anzeigen</summary>
          <p className="hint">Weitere Filter (Ausstattung, Entfernung, Bewertung) können hier ergänzt werden.</p>
        </details>
      </Surface>

      <div className="cards">
        {isLoading && <SkeletonCards />}
        {!isLoading && hasLoaded && items.length === 0 && (
          <EmptyState title="Keine Werkstätten gefunden" text="Passe die Suche an oder prüfe später erneut." />
        )}
        {publicWorkshops.map((item) => (
          <article
            key={item.workshop.id}
            className={`workshop-card workshop-card-public card-enter ${selectedWorkshop?.workshop.id === item.workshop.id ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => openWorkshop(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openWorkshop(item);
              }
            }}
          >
            <div className="workshop-card-media">
              <img src={item.workshop.imageUrls[0]} alt={item.workshop.name} />
              <span className="workshop-card-badge">{item.slots.length} Zeitfenster</span>
            </div>
            <div className="workshop-card-content">
              <div className="workshop-card-heading">
                <h3>{item.workshop.name}</h3>
                <span className="workshop-card-rating">{item.workshop.maxCapacity} Plätze</span>
              </div>
              <p>{item.workshop.location}</p>
              <p>{item.workshop.description}</p>
            </div>
          </article>
        ))}
      </div>

      {selectedWorkshop && (
        <div className="workshop-modal-backdrop" role="presentation" onClick={closeWorkshop}>
          <div
            className="workshop-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedWorkshop.workshop.name}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="workshop-modal-header">
              <div>
                <p className="eyebrow">Werkstattdetails</p>
                <h2>{selectedWorkshop.workshop.name}</h2>
                <p className="subtitle">{selectedWorkshop.workshop.location}</p>
              </div>
              <button type="button" className="icon-button workshop-modal-close" onClick={closeWorkshop} aria-label="Fenster schließen">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="workshop-modal-body">
              <p>{selectedWorkshop.workshop.description}</p>
              <div className="workshop-modal-meta">
                <span className="status-pill neutral">{selectedWorkshop.workshop.maxCapacity} Plätze</span>
                <span className="status-pill neutral">{selectedWorkshop.slots.length} Zeitfenster</span>
                {currentUser && selectedWorkshop.workshop.ownerId === currentUser.id && (
                  <span className="status-pill success">Eigene Werkstatt</span>
                )}
              </div>

              <div className="time-slots-display">
                {selectedWorkshop.slots.length > 0 ? (
                  <ul className="meta-list">
                    {selectedWorkshop.slots.map((slot) => (
                      <li key={slot.id} className="slot-item">
                        <div>
                          <strong>{formatWorkshopDate(slot.startIso)}</strong>
                          <span> bis </span>
                          <strong>{formatWorkshopDate(slot.endIso)}</strong>
                          {slot.blockedByOwner && <span className="slot-badge">blockiert</span>}
                        </div>
                        {!slot.blockedByOwner && currentUser?.id !== selectedWorkshop.workshop.ownerId && (
                          <button type="button" className="btn" onClick={() => void bookWorkshop(selectedWorkshop.workshop.id, slot.id)}>
                            {token ? "Buchen" : "Login"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">Keine Zeitfenster hinterlegt.</p>
                )}
              </div>
            </div>

            <div className="workshop-modal-footer">
              {currentUser && selectedWorkshop.workshop.ownerId === currentUser.id ? (
                <Link className="btn" to="/workshops/availability" onClick={closeWorkshop}>
                  Verfügbarkeit verwalten
                </Link>
              ) : (
                <button type="button" className="btn secondary" onClick={closeWorkshop}>
                  Fenster schließen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
