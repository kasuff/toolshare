import { useMemo, useState } from "react";
import { api } from "../services/mockApi";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
};

const statusLabel: Record<"VERFUEGBAR" | "AUSGELIEHEN", string> = {
  VERFUEGBAR: "Verfügbar",
  AUSGELIEHEN: "Ausgeliehen",
};

export function ToolsPage({ currentUser }: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [startIso, setStartIso] = useState("");
  const [endIso, setEndIso] = useState("");
  const [pickupIso, setPickupIso] = useState("");

  const tools = useMemo(() => api.getTools({ q, category }), [q, category]);

  const requestTool = (toolId: string) => {
    if (!startIso || !endIso || !pickupIso) {
      alert("Bitte Start, Ende und Abholzeit ausfüllen.");
      return;
    }

    const created = api.createToolRequest({
      requesterId: currentUser.id,
      toolId,
      startIso,
      endIso,
      pickupTimeIso: pickupIso,
    });

    if (!created) {
      alert("Anfrage konnte nicht erstellt werden.");
      return;
    }

    alert("Ausleihanfrage erstellt.");
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
              <button onClick={() => requestTool(t.id)} disabled={t.status !== "VERFUEGBAR"}>
                Ausleihe anfragen
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
