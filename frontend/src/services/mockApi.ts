import type {
  Booking,
  BookingStatus,
  Report,
  Role,
  SystemRule,
  Tool,
  User,
  Workshop,
  WorkshopSlot,
} from "../types/domain";
import { loadDb, saveDb, uid } from "./storage";

function addNotification(userId: string, message: string): void {
  const db = loadDb();
  db.notifications.unshift({
    id: uid("n"),
    userId,
    message,
    read: false,
    createdIso: new Date().toISOString(),
  });
  saveDb(db);
}

export const api = {
  getUsers(): User[] {
    return loadDb().users;
  },

  updateUserRole(userId: string, role: Role): void {
    const db = loadDb();
    const u = db.users.find((it) => it.id === userId);
    if (!u) return;
    u.role = role;
    saveDb(db);
  },

  toggleUserSuspended(userId: string): void {
    const db = loadDb();
    const u = db.users.find((it) => it.id === userId);
    if (!u) return;
    u.isSuspended = !u.isSuspended;
    saveDb(db);
  },

  getRules(): SystemRule[] {
    return loadDb().rules;
  },

  updateRule(ruleId: string, text: string): void {
    const db = loadDb();
    const r = db.rules.find((it) => it.id === ruleId);
    if (!r) return;
    r.text = text;
    saveDb(db);
  },

  getTools(filters: { q?: string; category?: string } = {}): Tool[] {
    const db = loadDb();
    const q = (filters.q || "").trim().toLowerCase();
    const category = (filters.category || "").trim().toLowerCase();
    return db.tools.filter((t) => {
      const qMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      const cMatch = !category || t.category.toLowerCase().includes(category);
      return qMatch && cMatch;
    });
  },

  createTool(input: Omit<Tool, "id" | "status">): Tool {
    const db = loadDb();
    const next: Tool = { ...input, id: uid("t"), status: "VERFUEGBAR" };
    db.tools.unshift(next);
    saveDb(db);
    return next;
  },

  getWorkshops(filters: { q?: string; toolFilter?: string } = {}): Array<{
    workshop: Workshop;
    slots: WorkshopSlot[];
    tools: Array<Tool & { selectable: boolean }>;
  }> {
    const db = loadDb();
    const q = (filters.q || "").trim().toLowerCase();
    const toolFilter = (filters.toolFilter || "").trim().toLowerCase();
    return db.workshops
      .filter((w) => {
        const baseMatch =
          !q ||
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q);
        return baseMatch;
      })
      .map((workshop) => {
        const slots = db.slots.filter((s) => s.workshopId === workshop.id);
        const tools = workshop.toolIds
          .map((tid) => db.tools.find((t) => t.id === tid))
          .filter((t): t is Tool => Boolean(t))
          .map((t) => ({
            ...t,
            selectable: t.status !== "AUSGELIEHEN",
          }))
          .filter((t) =>
            !toolFilter
              ? true
              : `${t.name} ${t.category}`.toLowerCase().includes(toolFilter),
          );
        return { workshop, slots, tools };
      });
  },

  createWorkshop(input: Omit<Workshop, "id">, slots: Omit<WorkshopSlot, "id" | "workshopId">[]): Workshop {
    const db = loadDb();
    const workshop: Workshop = { ...input, id: uid("w") };
    db.workshops.unshift(workshop);
    slots.forEach((s) => {
      db.slots.push({
        id: uid("s"),
        workshopId: workshop.id,
        startIso: s.startIso,
        endIso: s.endIso,
        blockedByOwner: s.blockedByOwner,
      });
    });
    saveDb(db);
    return workshop;
  },

  createToolRequest(input: {
    requesterId: string;
    toolId: string;
    startIso: string;
    endIso: string;
    pickupTimeIso: string;
  }): Booking | null {
    const db = loadDb();
    const tool = db.tools.find((t) => t.id === input.toolId);
    if (!tool || tool.status !== "VERFUEGBAR") return null;

    const startMs = new Date(input.startIso).getTime();
    const endMs = new Date(input.endIso).getTime();
    const overlap = db.bookings.some(
      (b) =>
        b.type === "TOOL" &&
        b.toolId === tool.id &&
        (b.status === "OFFEN" || b.status === "BESTAETIGT") &&
        new Date(b.startIso ?? "").getTime() < endMs &&
        new Date(b.endIso ?? "").getTime() > startMs
    );
    if (overlap) return null;

    const booking: Booking = {
      id: uid("b"),
      type: "TOOL",
      requesterId: input.requesterId,
      providerId: tool.ownerId,
      toolId: tool.id,
      startIso: input.startIso,
      endIso: input.endIso,
      pickupTimeIso: input.pickupTimeIso,
      status: "OFFEN",
      createdIso: new Date().toISOString(),
    };
    db.bookings.unshift(booking);
    saveDb(db);
    addNotification(tool.ownerId, `Neue Ausleihanfrage für ${tool.name}`);
    return booking;
  },

  createWorkshopBooking(input: {
    requesterId: string;
    workshopId: string;
    startIso: string;
    endIso: string;
    workshopToolIds: string[];
  }): Booking | null {
    const db = loadDb();
    const workshop = db.workshops.find((w) => w.id === input.workshopId);
    if (!workshop) return null;
    if (!input.workshopToolIds.length) return null;

    const startMs = new Date(input.startIso).getTime();
    const endMs = new Date(input.endIso).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) return null;

    const blockedOverlap = db.slots.some(
      (slot) =>
        slot.workshopId === workshop.id &&
        slot.blockedByOwner &&
        new Date(slot.startIso).getTime() < endMs &&
        new Date(slot.endIso).getTime() > startMs
    );
    if (blockedOverlap) return null;

    const availabilitySlot = db.slots.find((slot) => {
      if (slot.workshopId !== workshop.id || slot.blockedByOwner) return false;
      const slotStartMs = new Date(slot.startIso).getTime();
      const slotEndMs = new Date(slot.endIso).getTime();
      return slotStartMs <= startMs && slotEndMs >= endMs;
    });
    if (!availabilitySlot) return null;

    const selectedTools = workshop.equipmentItems.filter((tool) => input.workshopToolIds.includes(tool.id));
    if (selectedTools.length !== input.workshopToolIds.length) {
      return null;
    }

    const conflict = db.bookings.some(
      (b) =>
        b.type === "WORKSHOP" &&
        b.workshopId === workshop.id &&
        (b.status === "OFFEN" || b.status === "BESTAETIGT") &&
        new Date(b.startIso ?? "").getTime() < endMs &&
        new Date(b.endIso ?? "").getTime() > startMs,
    );
    if (conflict) return null;
    const booking: Booking = {
      id: uid("b"),
      type: "WORKSHOP",
      requesterId: input.requesterId,
      providerId: workshop.ownerId,
      workshopId: workshop.id,
      slotId: availabilitySlot.id,
      startIso: input.startIso,
      endIso: input.endIso,
      status: "OFFEN",
      createdIso: new Date().toISOString(),
      selectedWorkshopTools: selectedTools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        category: tool.category
      }))
    };
    db.bookings.unshift(booking);
    saveDb(db);
    addNotification(workshop.ownerId, `Neue Werkstattbuchung für ${workshop.name}`);
    return booking;
  },

  decideBooking(bookingId: string, status: Extract<BookingStatus, "BESTAETIGT" | "ABGELEHNT">): void {
    const db = loadDb();
    const b = db.bookings.find((it) => it.id === bookingId);
    if (!b) return;
    b.status = status;
    if (b.type === "TOOL" && b.toolId && status === "BESTAETIGT") {
      const t = db.tools.find((it) => it.id === b.toolId);
      if (t) t.status = "AUSGELIEHEN";
    }
    saveDb(db);
    addNotification(b.requesterId, `Buchung ${bookingId} wurde ${status.toLowerCase()}`);
  },

  suggestAlternativePickup(bookingId: string, altPickupTimeIso: string): void {
    const db = loadDb();
    const b = db.bookings.find((it) => it.id === bookingId);
    if (!b) return;
    b.altPickupTimeIso = altPickupTimeIso;
    saveDb(db);
    addNotification(b.requesterId, `Alternativzeit für Anfrage ${bookingId} wurde vorgeschlagen`);
  },

  closeBooking(bookingId: string): void {
    const db = loadDb();
    const b = db.bookings.find((it) => it.id === bookingId);
    if (!b) return;
    b.status = "ABGESCHLOSSEN";
    if (b.type === "TOOL" && b.toolId) {
      const t = db.tools.find((it) => it.id === b.toolId);
      if (t) t.status = "VERFUEGBAR";
    }
    saveDb(db);
  },

  getBookingsForUser(userId: string): Booking[] {
    const db = loadDb();
    return db.bookings.filter((b) => b.requesterId === userId || b.providerId === userId);
  },

  getNotifications(userId: string) {
    return loadDb().notifications.filter((n) => n.userId === userId);
  },

  createReport(input: Omit<Report, "id" | "status" | "createdIso">): void {
    const db = loadDb();
    db.reports.unshift({
      ...input,
      id: uid("r"),
      status: "OFFEN",
      createdIso: new Date().toISOString(),
    });
    saveDb(db);
  },

  getReports(): Report[] {
    return loadDb().reports;
  },

  resolveReport(reportId: string, note: string): void {
    const db = loadDb();
    const r = db.reports.find((it) => it.id === reportId);
    if (!r) return;
    r.status = "BEARBEITET";
    r.decisionNote = note;
    saveDb(db);
  },

  createRating(input: { bookingId: string; fromUserId: string; toUserId: string; score: number; comment: string }): void {
    const db = loadDb();
    db.ratings.unshift({
      id: uid("rt"),
      bookingId: input.bookingId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      score: input.score,
      comment: input.comment,
      status: "SICHTBAR",
    });
    saveDb(db);
  },

  getRatings() {
    return loadDb().ratings;
  },

  moderateRating(ratingId: string): void {
    const db = loadDb();
    const r = db.ratings.find((it) => it.id === ratingId);
    if (!r) return;
    r.status = "MODERIERT";
    saveDb(db);
  },

  getMetrics() {
    const db = loadDb();
    return {
      users: db.users.length,
      tools: db.tools.length,
      workshops: db.workshops.length,
      openBookings: db.bookings.filter((b) => b.status === "OFFEN").length,
      openReports: db.reports.filter((r) => r.status === "OFFEN").length,
    };
  },
};
