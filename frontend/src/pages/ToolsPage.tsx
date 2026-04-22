import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
};

const statusLabel: Record<"VERFUEGBAR" | "AUSGELIEHEN", string> = {
  VERFUEGBAR: "Verfügbar",
  AUSGELIEHEN: "Ausgeliehen",
};

export function ToolsPage({ token }: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [startIso, setStartIso] = useState("");
  const [endIso, setEndIso] = useState("");
  const [pickupIso, setPickupIso] = useState("");
  const [tools, setTools] = useState<Awaited<ReturnType<typeof api.getTools>>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const next = await api.getTools({ q, category }, token);
        setTools(next);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Werkzeuge konnten nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [q, category, token]);

  const requestTool = async (toolId: string) => {
    if (!startIso || !endIso || !pickupIso) {
      alert("Bitte Start, Ende und Abholzeit ausfüllen.");
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
      alert("Ausleihanfrage erstellt.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Anfrage konnte nicht erstellt werden.");
    }
  };

  return (
    <section>
      <h1>Werkzeuge</h1>

      <div className="panel">
        <h2>Suche und Filter</h2>
        <div className="grid grid-3">
          <input
            placeholder="Suche (Name/Beschreibung)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            placeholder="Kategorie"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </div>

      <div className="panel">
        <h2>Anfrageparameter</h2>
        <div className="grid grid-3">
          <label className="field-label">
            <span>Ausleihzeitraum von</span>
            <input type="datetime-local" value={startIso} onChange={(e) => setStartIso(e.target.value)} />
          </label>
          <label className="field-label">
            <span>Ausleihzeitraum bis</span>
            <input type="datetime-local" value={endIso} onChange={(e) => setEndIso(e.target.value)} />
          </label>
          <label className="field-label">
            <span>Gewünschte Abholzeit</span>
            <input type="datetime-local" value={pickupIso} onChange={(e) => setPickupIso(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="cards">
        {isLoading && <p>Lade Werkzeuge...</p>}
        {tools.map((t) => (
          <article key={t.id} className="card">
            <img src={t.imageUrl} alt={t.name} />
            <h3>{t.name}</h3>
            <p>{t.description}</p>
            <p>
              <strong>Kategorie:</strong> {t.category}
            </p>
            <p>
              <strong>Status:</strong> {statusLabel[t.status]}
            </p>
            <div className="row">
              <button onClick={() => void requestTool(t.id)} disabled={t.status !== "VERFUEGBAR"}>
                Ausleihe anfragen
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
