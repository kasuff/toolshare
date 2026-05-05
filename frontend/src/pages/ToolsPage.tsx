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
  const [tools, setTools] = useState<Awaited<ReturnType<typeof api.getTools>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

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

      <div className="cards">
        {isLoading && <SkeletonCards />}
        {!isLoading && hasLoaded && tools.length === 0 && (
          <EmptyState title="Keine Treffer" text="Passe Suche oder Kategorie an, um passende Werkzeuge zu finden." />
        )}
        {tools.map((t) => (
          <Link key={t.id} to={`/tools/${t.id}`} className="card card-enter card-link">
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
              <p className="card-link-hint">→ Klicke um Details und Buchung zu sehen</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
