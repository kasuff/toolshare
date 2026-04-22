import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
};

type WorkshopListItem = Awaited<ReturnType<typeof api.getWorkshops>>[number] & {
  tools: Array<{ id: string; name: string; selectable: boolean }>;
};

export function WorkshopsPage({ token }: Props) {
  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [items, setItems] = useState<WorkshopListItem[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const workshops = await api.getWorkshops({ q }, token);
        const mapped = workshops.map(({ workshop, slots }) => ({
          workshop,
          slots,
          tools: []
        }));
        const filtered = toolFilter
          ? mapped.filter((item) => item.workshop.name.toLowerCase().includes(toolFilter.toLowerCase()))
          : mapped;
        setItems(filtered);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Werkstätten konnten nicht geladen werden.");
      }
    };
    void run();
  }, [q, toolFilter, token]);

  const bookWorkshop = async (_workshopId: string, slotId: string) => {
    try {
      await api.createWorkshopBooking({ slotId }, token);
      alert("Werkstattbuchung erstellt.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Buchung fehlgeschlagen.");
    }
  };

  return (
    <section>
      <h1>Werkstätten</h1>
      <div className="panel">
        <div className="grid grid-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche Werkstatt" />
          <input
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            placeholder="Werkzeugfilter"
          />
        </div>
      </div>

      <div className="cards">
        {items.map(({ workshop, slots, tools }) => (
          <article className="card" key={workshop.id}>
            {workshop.imageUrls[0] && <img src={workshop.imageUrls[0]} alt={workshop.name} />}
            <h3>{workshop.name}</h3>
            <p>{workshop.description}</p>
            <p>
              <strong>Ort:</strong> {workshop.location}
            </p>
            <p>
              <strong>Max. Kapazität:</strong> {workshop.maxCapacity}
            </p>
            <p>
              <strong>Werkzeuge:</strong>
            </p>
            <ul>
              {tools.map((t) => (
                <li key={t.id}>
                  {t.name} {t.selectable ? "" : "(derzeit nicht auswählbar)"}
                </li>
              ))}
            </ul>
            <p>
              <strong>Slots:</strong>
            </p>
            <ul>
              {slots.map((s) => (
                <li key={s.id}>
                  {new Date(s.startIso).toLocaleString()} - {new Date(s.endIso).toLocaleString()}{" "}
                  {!s.blockedByOwner && (
                    <button className="mini" onClick={() => void bookWorkshop(workshop.id, s.id)}>
                      Buchen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
