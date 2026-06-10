import { useEffect, useState } from "react";
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

type SlotDraft = {
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
};

export function WorkshopAvailabilityPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const [workshops, setWorkshops] = useState<WorkshopWithSlots[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithSlots | null>(null);
  const [slots, setSlots] = useState<WorkshopSlot[]>([]);
  const [draft, setDraft] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: false });
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: false });
  const [loading, setLoading] = useState(true);

  const sortSlots = (items: WorkshopSlot[]) =>
    [...items].sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

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
          setSlots(sortSlots(ownedWorkshops[0].slots || []));
        }
      } catch {
        pushToast("Werkstätten konnten nicht geladen werden.", "error");
      } finally {
        setLoading(false);
      }
    };

    void fetchWorkshops();
  }, [token, currentUser, pushToast]);

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
    setSlots(sortSlots(workshop.slots || []));
    setDraft({ startIso: "", endIso: "", blockedByOwner: false });
    setEditingSlotId(null);
    setEditingDraft({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const applySlotsUpdate = (nextSlots: WorkshopSlot[]) => {
    const sorted = sortSlots(nextSlots);
    setSlots(sorted);
    if (!selectedWorkshop) return;

    setWorkshops((prev) =>
      prev.map((entry) =>
        entry.workshop.id === selectedWorkshop.workshop.id
          ? {
              ...entry,
              slots: sorted
            }
          : entry
      )
    );
    setSelectedWorkshop((prev) =>
      prev
        ? {
            ...prev,
            slots: sorted
          }
        : prev
    );
  };

  const refreshWorkshopState = async (workshopId: string) => {
    if (!token || !currentUser) return;
    const allWorkshops = await api.getWorkshops({}, token);
    const ownedWorkshops = allWorkshops.filter((entry) => entry.workshop.ownerId === currentUser.id);
    setWorkshops(ownedWorkshops);

    const refreshedWorkshop = ownedWorkshops.find((entry) => entry.workshop.id === workshopId) ?? null;
    setSelectedWorkshop(refreshedWorkshop);
    setSlots(sortSlots(refreshedWorkshop?.slots ?? []));
  };

  const validateSlot = (candidate: SlotDraft) => {
    if (!candidate.startIso || !candidate.endIso) {
      pushToast("Bitte Start und Ende für das Zeitfenster angeben.", "error");
      return false;
    }
    if (new Date(candidate.startIso) >= new Date(candidate.endIso)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return false;
    }
    return true;
  };

  const addSlot = async () => {
    if (!selectedWorkshop || !token) {
      pushToast("Bitte wählen Sie eine Werkstatt aus.", "error");
      return;
    }
    if (!validateSlot(draft)) return;

    try {
      await api.createWorkshopTimeslot(
        selectedWorkshop.workshop.id,
        {
          startIso: draft.startIso,
          endIso: draft.endIso,
          blockedByOwner: draft.blockedByOwner
        },
        token
      );
      await refreshWorkshopState(selectedWorkshop.workshop.id);
      setDraft({ startIso: "", endIso: "", blockedByOwner: false });
      pushToast("Zeitfenster gespeichert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht gespeichert werden.", "error");
    }
  };

  const startEditing = (slot: WorkshopSlot) => {
    setEditingSlotId(slot.id);
    setEditingDraft({
      startIso: slot.startIso,
      endIso: slot.endIso,
      blockedByOwner: slot.blockedByOwner
    });
  };

  const cancelEditing = () => {
    setEditingSlotId(null);
    setEditingDraft({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const saveEditedSlot = async () => {
    if (!selectedWorkshop || !token || !editingSlotId) {
      return;
    }
    if (!validateSlot(editingDraft)) return;

    const existingSlot = slots.find((slot) => slot.id === editingSlotId);
    if (!existingSlot) {
      pushToast("Zeitfenster konnte nicht gefunden werden.", "error");
      return;
    }

    const updatePayload: { startIso?: string; endIso?: string; blockedByOwner?: boolean } = {};
    if (editingDraft.startIso !== existingSlot.startIso) {
      updatePayload.startIso = editingDraft.startIso;
    }
    if (editingDraft.endIso !== existingSlot.endIso) {
      updatePayload.endIso = editingDraft.endIso;
    }
    if (editingDraft.blockedByOwner !== existingSlot.blockedByOwner) {
      updatePayload.blockedByOwner = editingDraft.blockedByOwner;
    }
    if (Object.keys(updatePayload).length === 0) {
      cancelEditing();
      return;
    }

    try {
      const updated = await api.updateWorkshopTimeslot(
        selectedWorkshop.workshop.id,
        editingSlotId,
        updatePayload,
        token
      );
      applySlotsUpdate(slots.map((slot) => (slot.id === editingSlotId ? updated : slot)));
      cancelEditing();
      pushToast("Zeitfenster aktualisiert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht aktualisiert werden.", "error");
    }
  };

  const removeSlot = async (slotId: string) => {
    if (!selectedWorkshop || !token) return;
    try {
      await api.deleteWorkshopTimeslot(selectedWorkshop.workshop.id, slotId, token);
      applySlotsUpdate(slots.filter((slot) => slot.id !== slotId));
      if (editingSlotId === slotId) {
        cancelEditing();
      }
      pushToast("Zeitfenster entfernt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht entfernt werden.", "error");
    }
  };

  const toggleBlocked = async (slot: WorkshopSlot) => {
    if (!selectedWorkshop || !token) return;
    try {
      const updated = await api.updateWorkshopTimeslot(
        selectedWorkshop.workshop.id,
        slot.id,
        { blockedByOwner: !slot.blockedByOwner },
        token
      );
      applySlotsUpdate(slots.map((item) => (item.id === slot.id ? updated : item)));
      pushToast(updated.blockedByOwner ? "Zeitfenster blockiert." : "Zeitfenster freigegeben.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Status konnte nicht geändert werden.", "error");
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
          <Surface title="Neues Zeitfenster hinzufügen" subtitle="Lege zusätzliche verfügbare Zeiten oder Blockierungen an">
            <div className="grid grid-3">
              <Field label="Startzeit">
                <input
                  type="datetime-local"
                  value={draft.startIso}
                  onChange={(e) => setDraft((prev) => ({ ...prev, startIso: e.target.value }))}
                />
              </Field>
              <Field label="Endzeit">
                <input
                  type="datetime-local"
                  value={draft.endIso}
                  onChange={(e) => setDraft((prev) => ({ ...prev, endIso: e.target.value }))}
                />
              </Field>
              <label className="field" style={{ paddingTop: "1.5rem" }}>
                <span>Als blockiert markieren</span>
                <input
                  type="checkbox"
                  checked={draft.blockedByOwner}
                  onChange={(e) => setDraft((prev) => ({ ...prev, blockedByOwner: e.target.checked }))}
                />
              </label>
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => void addSlot()}>
                Änderungen speichern
              </button>
            </div>
          </Surface>

          <Surface title="Bestehende Zeitfenster" subtitle="Zeiten bearbeiten, blockieren/freigeben oder entfernen">
            {slots.length > 0 ? (
              <div className="time-slots-display">
                <ul className="meta-list">
                  {slots.map((slot) => {
                    const isEditing = editingSlotId === slot.id;
                    return (
                      <li key={slot.id} className={`slot-item ${isEditing ? "slot-item-editing" : ""}`}>
                        {isEditing ? (
                          <div className="slot-edit-form">
                            <div className="grid grid-3">
                              <Field label="Startzeit">
                                <input
                                  type="datetime-local"
                                  value={editingDraft.startIso}
                                  onChange={(e) => setEditingDraft((prev) => ({ ...prev, startIso: e.target.value }))}
                                />
                              </Field>
                              <Field label="Endzeit">
                                <input
                                  type="datetime-local"
                                  value={editingDraft.endIso}
                                  onChange={(e) => setEditingDraft((prev) => ({ ...prev, endIso: e.target.value }))}
                                />
                              </Field>
                              <label className="field" style={{ paddingTop: "1.5rem" }}>
                                <span>Blockiert</span>
                                <input
                                  type="checkbox"
                                  checked={editingDraft.blockedByOwner}
                                  onChange={(e) => setEditingDraft((prev) => ({ ...prev, blockedByOwner: e.target.checked }))}
                                />
                              </label>
                            </div>
                            <div className="row slot-edit-actions">
                              <button type="button" onClick={() => void saveEditedSlot()}>
                                Änderungen speichern
                              </button>
                              <button type="button" className="btn secondary" onClick={cancelEditing}>
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <strong>{new Date(slot.startIso).toLocaleString("de-DE")}</strong>
                              {" – "}
                              <strong>{new Date(slot.endIso).toLocaleString("de-DE")}</strong>
                              {slot.blockedByOwner && <span className="slot-badge">blockiert</span>}
                            </div>
                            <div className="row slot-actions">
                              <button type="button" className="btn secondary" onClick={() => startEditing(slot)}>
                                Bearbeiten
                              </button>
                              <button type="button" className="btn secondary" onClick={() => void toggleBlocked(slot)}>
                                {slot.blockedByOwner ? "Freigeben" : "Blockieren"}
                              </button>
                              <button type="button" className="btn ghost danger" onClick={() => void removeSlot(slot.id)}>
                                Entfernen
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                Keine Zeitfenster konfiguriert
              </p>
            )}
          </Surface>
        </>
      )}
    </section>
  );
}
