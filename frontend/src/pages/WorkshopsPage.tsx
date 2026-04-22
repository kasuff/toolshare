import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { EmptyState, Field, GuestBanner, SkeletonCards, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";

type Props = {
  token?: string;
};

type WorkshopListItem = Awaited<ReturnType<typeof api.getWorkshops>>[number] & {
  tools: Array<{ id: string; name: string; selectable: boolean }>;
};

export function WorkshopsPage({ token }: Props) {
  const { pushToast } = useToast();
  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [maxCapacityFilter, setMaxCapacityFilter] = useState(10);
  const [items, setItems] = useState<WorkshopListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

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
        pushToast(error instanceof Error ? error.message : "Werkstätten konnten nicht geladen werden.", "error");
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    };
    void run();
  }, [q, toolFilter, token, pushToast, maxCapacityFilter]);

  const bookWorkshop = async (_workshopId: string, slotId: string) => {
    if (!token) {
      pushToast("Bitte logge dich ein, um eine Werkstatt zu buchen.", "error");
      return;
    }
    try {
      await api.createWorkshopBooking({ slotId }, token);
      pushToast("Werkstattbuchung erstellt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Buchung fehlgeschlagen.", "error");
    }
  };

  return (
    <section className="stack">
      <h1>Werkstätten</h1>
      <Surface title="Suche" className="interactive">
        <div className="filter-toolbar">
          <p className="result-summary">
            {isLoading ? "Suche läuft..." : `${items.length} Ergebnis${items.length === 1 ? "" : "se"}`}
          </p>
          {(q || toolFilter || maxCapacityFilter !== 10) && (
            <button className="btn secondary" onClick={() => {
              setQ("");
              setToolFilter("");
              setMaxCapacityFilter(10);
            }}>
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
      {!token && (
        <GuestBanner text="Als Gast kannst du Werkstätten ansehen. Für Buchungen bitte einloggen." />
      )}

      <div className="cards">
        {isLoading && <SkeletonCards />}
        {!isLoading && hasLoaded && items.length === 0 && (
          <EmptyState title="Keine Werkstätten gefunden" text="Passe die Suche an oder prüfe später erneut." />
        )}
        {items.map(({ workshop, slots, tools }) => (
          <article className="card card-enter" key={workshop.id}>
            {workshop.imageUrls[0] && (
              <figure>
                <img src={workshop.imageUrls[0]} alt={workshop.name} />
              </figure>
            )}
            <div className="card-content">
              <h3>{workshop.name}</h3>
              <p>{workshop.description}</p>
              <ul className="meta-list">
                <li>
                  <strong>Ort:</strong> {workshop.location}
                </li>
                <li>
                  <strong>Max. Kapazität:</strong> {workshop.maxCapacity}
                </li>
              </ul>
              <p>
                <strong>Werkzeuge:</strong>
              </p>
              <ul className="meta-list">
                {tools.length === 0 && <li>Keine Werkzeuge hinterlegt.</li>}
                {tools.map((t) => (
                  <li key={t.id}>
                    {t.name} {t.selectable ? "" : "(derzeit nicht auswählbar)"}
                  </li>
                ))}
              </ul>
              <p>
                <strong>Verfügbare Slots:</strong>
              </p>
              <div className="stack">
                {slots.map((s) => (
                  <div key={s.id} className="row">
                    <span>
                      {new Date(s.startIso).toLocaleString()} - {new Date(s.endIso).toLocaleString()}
                    </span>
                    {!s.blockedByOwner && (
                      <>
                        <span className="chip">frei</span>
                        {token ? (
                          <button className="mini" onClick={() => void bookWorkshop(workshop.id, s.id)} disabled={!token}>
                            Buchen
                          </button>
                        ) : (
                          <Link className="btn mini" to="/auth">
                            Login
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
