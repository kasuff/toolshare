import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { EmptyState, Field, GuestBanner, SkeletonCards, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
type Props = {
  token?: string;
};

const statusLabel: Record<"VERFUEGBAR" | "AUSGELIEHEN", string> = {
  VERFUEGBAR: "Verfügbar",
  AUSGELIEHEN: "Ausgeliehen",
};

export function ToolsPage({ token }: Props) {
  const { pushToast } = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [startIso, setStartIso] = useState("");
  const [pickupIso, setPickupIso] = useState("");
  const [durationDays, setDurationDays] = useState(2);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [tools, setTools] = useState<Awaited<ReturnType<typeof api.getTools>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const computeEndIso = (startValue: string, days: number) => {
    if (!startValue) return "";
    const start = new Date(startValue);
    if (Number.isNaN(start.getTime())) return "";
    start.setDate(start.getDate() + days);
    return `${start.getFullYear()}-${`${start.getMonth() + 1}`.padStart(2, "0")}-${`${start.getDate()}`.padStart(2, "0")}T${`${start.getHours()}`.padStart(2, "0")}:${`${start.getMinutes()}`.padStart(2, "0")}`;
  };

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const next = await api.getTools({ q, category }, token ?? "");
        setTools(next);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Werkzeuge konnten nicht geladen werden.", "error");
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    };
    void run();
  }, [q, category, token, pushToast]);

  const requestTool = async (toolId: string) => {
    const endIso = computeEndIso(startIso, durationDays);
    if (!startIso || !endIso || !pickupIso) {
      pushToast("Bitte Start, Ende und Abholzeit ausfüllen.", "error");
      return;
    }
    if (!token) {
      pushToast("Bitte logge dich ein, um eine Ausleihe anzufragen.", "error");
      return;
    }

    try {
      await api.createToolRequest(
        {
          toolId,
          startIso,
          endIso,
          pickupTimeIso: pickupIso
        },
        token
      );
      pushToast("Ausleihanfrage erstellt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Anfrage konnte nicht erstellt werden.", "error");
    }
  };

  return (
    <section className="stack">
      <h1>Werkzeuge</h1>

      <Surface title="Suche und Filter" className="interactive">
        <div className="filter-toolbar">
          <p className="result-summary">
            {isLoading ? "Suche läuft..." : `${tools.length} Ergebnis${tools.length === 1 ? "" : "se"}`}
          </p>
          {(q || category) && (
            <button className="btn secondary" onClick={() => {
              setQ("");
              setCategory("");
            }}>
              Filter zurücksetzen
            </button>
          )}
        </div>
        <div className="grid grid-2">
          <Field label="Suche">
            <input placeholder="Name oder Beschreibung" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Kategorie">
            <input placeholder="z.B. Holz, Garten, Elektro" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
        </div>
        <details>
          <summary>Erweiterte Filter anzeigen</summary>
          <p className="hint">Für weitere Filter ist später Platz (z.B. Entfernung, Verfügbarkeit, Bewertung).</p>
        </details>
      </Surface>
      {!token && (
        <GuestBanner text="Du kannst als Gast stöbern. Für Ausleihanfragen bitte einloggen." />
      )}

      {token && (
        <Surface
          title="Ausleihanfrage vorbereiten"
          subtitle="Die Eingaben gelten für die ausgewählte Karte"
          className="interactive"
        >
          <div className="request-panel">
            <Field label="Ausleihstart">
              <input type="datetime-local" value={startIso} onChange={(e) => setStartIso(e.target.value)} />
            </Field>
            <div className="slider-row">
              <label htmlFor="duration-slider">
                Dauer: <strong>{durationDays} Tag{durationDays === 1 ? "" : "e"}</strong>
              </label>
              <input
                id="duration-slider"
                type="range"
                min={1}
                max={14}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              />
              <p className="hint">Ende wird automatisch berechnet: {computeEndIso(startIso, durationDays) || "—"}</p>
            </div>
            <Field label="Gewünschte Abholzeit">
              <input type="datetime-local" value={pickupIso} onChange={(e) => setPickupIso(e.target.value)} />
            </Field>
          </div>
        </Surface>
      )}

      <div className="cards">
        {isLoading && <SkeletonCards />}
        {!isLoading && hasLoaded && tools.length === 0 && (
          <EmptyState title="Keine Treffer" text="Passe Suche oder Kategorie an, um passende Werkzeuge zu finden." />
        )}
        {tools.map((t) => (
          <article key={t.id} className="card card-enter">
            <figure>
              <img src={t.imageUrl} alt={t.name} />
            </figure>
            <div className="card-content">
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <ul className="meta-list">
                <li>
                  <strong>Kategorie:</strong> {t.category}
                </li>
                <li>
                  <strong>Status:</strong>{" "}
                  <StatusPill
                    label={statusLabel[t.status]}
                    tone={t.status === "VERFUEGBAR" ? "success" : "warning"}
                  />
                </li>
              </ul>
              <div className="row">
                {q && <span className="chip">Suchbezug: {q}</span>}
                {category && <span className="chip">Kategorie: {category}</span>}
              </div>
              <div className="row">
                {token ? (
                  <>
                    <button className="btn secondary" onClick={() => setActiveToolId(t.id)}>
                      Anfrage vorbereiten
                    </button>
                    <button
                      onClick={() => void requestTool(t.id)}
                      disabled={t.status !== "VERFUEGBAR" || activeToolId !== t.id}
                      title={activeToolId !== t.id ? "Bitte zuerst Anfrage vorbereiten wählen." : undefined}
                    >
                      Jetzt anfragen
                    </button>
                  </>
                ) : (
                  <Link className="btn" to="/auth">
                    Einloggen zum Anfragen
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
