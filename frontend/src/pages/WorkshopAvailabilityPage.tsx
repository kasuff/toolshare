import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Field, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "@toolshare/shared";
import type { User, WorkshopSlot } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";

type WorkshopWithSlots = {
  workshop: import("@toolshare/shared").Workshop;
  slots: WorkshopSlot[];
};

type SlotDraft = {
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
};

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function WorkshopAvailabilityPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithSlots | null>(null);
  const [slots, setSlots] = useState<WorkshopSlot[]>([]);
  const [draft, setDraft] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: true });
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SlotDraft>({ startIso: "", endIso: "", blockedByOwner: false });

  const sortSlots = (items: WorkshopSlot[]) =>
    [...items].sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  const { data: workshops = [], isLoading, isError } = useQuery({
    queryKey: ["workshops", "owned", token],
    queryFn: async () => {
      if (!token || !currentUser) throw new Error("Missing auth");
      const allWorkshops = await api.getWorkshops({}, token);
      return allWorkshops.filter((entry) => entry.workshop.ownerId === currentUser.id);
    },
    enabled: !!token && !!currentUser
  });

  useEffect(() => {
    if (isError) {
      pushToast("Werkstätten konnten nicht geladen werden.", "error");
    }
  }, [isError, pushToast]);

  useEffect(() => {
    if (workshops.length > 0) {
      if (!selectedWorkshop) {
        setSelectedWorkshop(workshops[0]);
        setSlots(sortSlots(workshops[0].slots || []));
      } else {
        const updated = workshops.find((w) => w.workshop.id === selectedWorkshop.workshop.id);
        if (updated) {
          setSelectedWorkshop(updated);
          setSlots(sortSlots(updated.slots || []));
        }
      }
    }
  }, [workshops, selectedWorkshop]);

  const { mutate: addSlotMut } = useMutation({
    mutationFn: async () => {
      if (!selectedWorkshop || !token) throw new Error("Missing context");
      await api.createWorkshopTimeslot(
        selectedWorkshop.workshop.id,
        {
          startIso: draft.startIso,
          endIso: draft.endIso,
          blockedByOwner: true
        },
        token
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops", "owned"] });
      setDraft({ startIso: "", endIso: "", blockedByOwner: true });
      pushToast("Zeitraum blockiert.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Zeitraum konnte nicht blockiert werden.", "error");
    }
  });

  const { mutate: updateSlotMut } = useMutation({
    mutationFn: async (updatePayload: { startIso?: string; endIso?: string; blockedByOwner?: boolean }) => {
      if (!selectedWorkshop || !token || !editingSlotId) throw new Error("Missing context");
      await api.updateWorkshopTimeslot(
        selectedWorkshop.workshop.id,
        editingSlotId,
        updatePayload,
        token
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshops", "owned"] });
      cancelEditing();
      pushToast("Zeitfenster aktualisiert.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht aktualisiert werden.", "error");
    }
  });

  const { mutate: removeSlotMut } = useMutation({
    mutationFn: async (slotId: string) => {
      if (!selectedWorkshop || !token) throw new Error("Missing context");
      await api.deleteWorkshopTimeslot(selectedWorkshop.workshop.id, slotId, token);
      return slotId;
    },
    onSuccess: (slotId) => {
      queryClient.invalidateQueries({ queryKey: ["workshops", "owned"] });
      if (editingSlotId === slotId) {
        cancelEditing();
      }
      pushToast("Zeitfenster entfernt.", "success");
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Zeitfenster konnte nicht entfernt werden.", "error");
    }
  });

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

  if (isLoading) {
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
    setDraft({ startIso: "", endIso: "", blockedByOwner: true });
    setEditingSlotId(null);
    setEditingDraft({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const validateSlot = (candidate: SlotDraft) => {
    if (!candidate.startIso || !candidate.endIso) {
      return false;
    }
    if (new Date(candidate.startIso) >= new Date(candidate.endIso)) {
      pushToast("Die Endzeit muss nach der Startzeit liegen.", "error");
      return false;
    }
    return true;
  };

  const addSlot = () => {
    if (!validateSlot(draft)) return;
    addSlotMut();
  };

  const cancelEditing = () => {
    setEditingSlotId(null);
    setEditingDraft({ startIso: "", endIso: "", blockedByOwner: false });
  };

  const startEditing = (slot: WorkshopSlot) => {
    setEditingSlotId(slot.id);
    setEditingDraft({
      startIso: slot.startIso,
      endIso: slot.endIso,
      blockedByOwner: slot.blockedByOwner
    });
  };

  const saveEditedSlot = () => {
    if (!editingSlotId) return;
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

    updateSlotMut(updatePayload);
  };

  const blockedSlots = slots.filter((slot) => slot.blockedByOwner);

  return (
    <section className="stack">
      <h1>Zeiten blockieren</h1>
      <p className="subtitle">
        Deine Werkstatt ist standardmäßig immer buchbar. Hier blockierst du Zeiträume, in denen sie nicht gebucht werden
        kann – z.&nbsp;B. für Wartung oder Eigennutzung.
      </p>

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
                  <span className="workshop-slots-count">
                    {workshop.slots.filter((slot) => slot.blockedByOwner).length} blockierte Zeiten
                  </span>
              </div>
            </button>
          ))}
        </div>
      </Surface>

      {selectedWorkshop && (
        <>
          <Surface title="Zeitraum blockieren" subtitle="Lege einen Zeitraum fest, in dem die Werkstatt nicht buchbar ist">
            <div className="grid grid-2">
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
            </div>
            <div className="row">
              <button
                type="button"
                className="btn secondary"
                onClick={addSlot}
                aria-label={`Zeitraum für ${selectedWorkshop.workshop.name} blockieren`}
              >
                Zeitraum blockieren
              </button>
            </div>
          </Surface>

          <Surface title="Blockierte Zeiten" subtitle="Blockierte Zeiträume bearbeiten oder wieder freigeben">
            {blockedSlots.length > 0 ? (
              <div className="time-slots-display">
                <ul className="meta-list">
                  {blockedSlots.map((slot) => {
                    const isEditing = editingSlotId === slot.id;
                    return (
                      <li key={slot.id} className={`slot-item ${isEditing ? "slot-item-editing" : ""}`}>
                        {isEditing ? (
                          <div className="slot-edit-form">
                            <div className="grid grid-2">
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
                            </div>
                            <div className="row slot-edit-actions">
                              <button type="button" onClick={saveEditedSlot}>
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
                              <span className="slot-badge">blockiert</span>
                            </div>
                            <div className="row slot-actions">
                              <button type="button" className="btn secondary" onClick={() => startEditing(slot)}>
                                Bearbeiten
                              </button>
                              <button type="button" className="btn ghost danger" onClick={() => removeSlotMut(slot.id)}>
                                Freigeben
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
                Keine blockierten Zeiten – die Werkstatt ist durchgehend buchbar.
              </p>
            )}
          </Surface>
        </>
      )}
    </section>
  );
}
