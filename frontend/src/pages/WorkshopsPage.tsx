import { useMemo, useState } from "react";
import { api } from "../services/mockApi";
import type { User } from "../types/domain";

type Props = {
  currentUser: User;
};

export function WorkshopsPage({ currentUser }: Props) {
  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState("");

  const items = useMemo(() => api.getWorkshops({ q, toolFilter }), [q, toolFilter]);

  const bookWorkshop = (workshopId: string, slotId: string) => {
    const created = api.createWorkshopBooking({
      requesterId: currentUser.id,
      workshopId,
      slotId,
    });

    if (!created) {
      alert("Buchung fehlgeschlagen (ggf. blockierter oder bereits belegter Slot).");
      return;
    }

    alert("Werkstattbuchung erstellt.");
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
                  {new Date(s.startIso).toLocaleString()} - {new Date(s.endIso).toLocaleString()} {" "}
                  {s.blockedByOwner ? "(blockiert)" : ""}
                  {!s.blockedByOwner && (
                    <button className="mini" onClick={() => bookWorkshop(workshop.id, s.id)}>
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
