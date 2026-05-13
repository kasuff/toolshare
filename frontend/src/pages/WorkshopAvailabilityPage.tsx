import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { User, Workshop, WorkshopSlot } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

type WorkshopWithSlots = {
  workshop: Workshop;
  slots: WorkshopSlot[];
};

type BlockingDraft = {
  startIso: string;
  endIso: string;
};

export function WorkshopAvailabilityPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const [workshops, setWorkshops] = useState<WorkshopWithSlots[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithSlots | null>(null);
  const [slots, setSlots] = useState<WorkshopSlot[]>([]);
  const [blocking, setBlocking] = useState<BlockingDraft>({ startIso: "", endIso: "" });
  const [blockings, setBlockings] = useState<BlockingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkshops = async () => {
      if (!token || !currentUser) {
        setLoading(false);
        return;
      }

      try {
        const allWorkshops = await api.getWorkshops({}, token);
        const ownedWorkshops = allWorkshops.filter((entry) => entry.workshop.ownerId === currentUser.id);
        setWorkshops(ownedWorkshops);

        if (ownedWorkshops.length > 0) {
          setSelectedWorkshop(ownedWorkshops[0]);
          setSlots(ownedWorkshops[0].slots || []);
        }
      } catch (error) {
        pushToast("Werkstätten konnten nicht geladen werden.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchWorkshops();
  }, [token, currentUser]);

  if (!token) {
    return (
      <section className="stack">
        <h1>Verfügbarkeit verwalten</h1>
        <Surface title="Login erforderlich" subtitle="Zum Verwalten einer Werkstatt musst du eingeloggt sein">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="stack">
        <h1>Verfügbarkeit verwalten</h1>
        <Surface title="Lädt...">
          <p>Deine Werkstätten werden geladen...</p>
        </Surface>
      </section>
    );
  }

  if (workshops.length === 0) {
    return (
      <section className="stack">
        <h1>Verfügbarkeit verwalten</h1>
        <Surface title="Keine Werkstätten gefunden">
          <p>Du hast noch keine Werkstätten erstellt. Erstelle zunächst eine Werkstatt, um die Verfügbarkeit zu verwalten.</p>
          <div className="row">
            <Link to="/workshops/new" className="btn">
              Neue Werkstatt erstellen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  const handleSelectWorkshop = (workshop: WorkshopWithSlots) => {
    setSelectedWorkshop(workshop);
    setSlots(workshop.slots || []);
    setBlockings([]);
    setBlocking({ startIso: "", endIso: "" });
  };

  const addBlocking = () => {
    if (!blocking.startIso || !blocking.endIso) {
      pushToast("Bitte Start und Ende für die Blockierung angeben.", "error");
      return;
    }
    if (new Date(blocking.startIso) >= new Date(blocking.endIso)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return;
    }
    setBlockings((prev) => [...prev, blocking]);
    setBlocking({ startIso: "", endIso: "" });
  };

  const removeBlocking = (index: number) => {
    setBlockings((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedWorkshop) {
      pushToast("Bitte wählen Sie eine Werkstatt aus.", "error");
      return;
    }

    try {
      // Here you would call the API to update blockings
      // For now, just show a success message
      pushToast("Verfügbarkeit aktualisiert.", "success");
      setBlockings([]);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Verfügbarkeit konnte nicht aktualisiert werden.", "error");
    }
  };

  return (
    <section className="stack">
      <h1>Verfügbarkeit & Zeitfenster</h1>
      <p className="subtitle">Verwalte die Buchungen und blockiere Zeiten für Wartungsarbeiten.</p>

      <Surface title="Werkstatt wählen" subtitle="Wähle eine deiner Werkstätten aus">
        <div className="workshop-selector">
            {workshops.map((workshop) => (
            <button
                key={workshop.workshop.id}
                type="button"
                onClick={() => handleSelectWorkshop(workshop)}
                className={`workshop-card ${selectedWorkshop?.workshop.id === workshop.workshop.id ? "selected" : ""}`}
              >
              <div className="workshop-card-content">
                  <h3>{workshop.workshop.name}</h3>
                  <p>{workshop.workshop.location}</p>
                  <span className="workshop-slots-count">{workshop.slots.length} Zeitfenster</span>
              </div>
            </button>
          ))}
        </div>
      </Surface>

      {selectedWorkshop && (
        <>
          <Surface title="Verfügbare Zeitfenster" subtitle="Deine konfigurierten Öffnungszeiten">
            {slots.length > 0 ? (
              <div className="time-slots-display">
                <ul className="meta-list">
                  {slots.map((slot) => (
                    <li key={slot.id} className="slot-item">
                      <div>
                        <strong>{new Date(slot.startIso).toLocaleString("de-DE")}</strong>
                        {" – "}
                        <strong>{new Date(slot.endIso).toLocaleString("de-DE")}</strong>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                Keine Zeitfenster konfiguriert
              </p>
            )}
          </Surface>

          <Surface title="Blockierungen hinzufügen" subtitle="Blockiere Zeiten für Wartung, Reinigung oder andere Aktivitäten">
            <form className="stack" onSubmit={onSubmit}>
              <div className="grid grid-3">
                <Field label="Startzeit">
                  <input
                    type="datetime-local"
                    value={blocking.startIso}
                    onChange={(e) => setBlocking({ ...blocking, startIso: e.target.value })}
                  />
                </Field>
                <Field label="Endzeit">
                  <input
                    type="datetime-local"
                    value={blocking.endIso}
                    onChange={(e) => setBlocking({ ...blocking, endIso: e.target.value })}
                  />
                </Field>
                <div style={{ paddingTop: "1.5rem" }}>
                  <button type="button" className="btn secondary" onClick={addBlocking}>
                    Blockierung hinzufügen
                  </button>
                </div>
              </div>

              <div className="time-slots-list">
                {blockings.length > 0 && (
                  <ul className="meta-list">
                    {blockings.map((b, i) => (
                      <li key={`${b.startIso}-${i}`} className="slot-item">
                        <div>
                          <strong>{new Date(b.startIso).toLocaleString("de-DE")}</strong>
                          {" – "}
                          <strong>{new Date(b.endIso).toLocaleString("de-DE")}</strong>
                          <span className="slot-badge">blockiert</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBlocking(i)}
                          className="btn ghost danger"
                          style={{ padding: "0.25rem 0.5rem" }}
                        >
                          Entfernen
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {blockings.length === 0 && (
                  <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    Noch keine Blockierungen hinzugefügt
                  </p>
                )}
              </div>

              {blockings.length > 0 && (
                <div className="row">
                  <button type="submit">Blockierungen speichern</button>
                </div>
              )}
            </form>
          </Surface>
        </>
      )}
    </section>
  );
}
