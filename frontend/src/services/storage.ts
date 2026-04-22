import type { AppDb } from "../types/domain";

const STORAGE_KEY = "toolshare_mvp_db_v1";

const now = new Date();
const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

const DEFAULT_DB: AppDb = {
  users: [
    { id: "u1", name: "Lea", email: "lea@toolshare.local", role: "NUTZER", isSuspended: false },
    { id: "u2", name: "Murat", email: "murat@toolshare.local", role: "NUTZER", isSuspended: false },
    { id: "u3", name: "Nina", email: "nina@toolshare.local", role: "NUTZER", isSuspended: false },
    { id: "u4", name: "Tobias", email: "tobias@toolshare.local", role: "MODERATOR", isSuspended: false },
    { id: "u5", name: "Sabine", email: "sabine@toolshare.local", role: "ADMIN", isSuspended: false },
  ],
  tools: [
    {
      id: "t1",
      ownerId: "u3",
      name: "Akkuschrauber Bosch",
      description: "Gut erhalten, inkl. Ladegerät und Bits.",
      category: "Bohrmaschine",
      imageUrl: "https://picsum.photos/seed/tool1/600/300",
      status: "VERFUEGBAR",
    },
    {
      id: "t2",
      ownerId: "u2",
      name: "Stichsäge Makita",
      description: "Für Holz und Kunststoff, 3 Sägeblätter inklusive.",
      category: "Säge",
      imageUrl: "https://picsum.photos/seed/tool2/600/300",
      status: "VERFUEGBAR",
    },
  ],
  workshops: [
    {
      id: "w1",
      ownerId: "u2",
      name: "Kellerwerkstatt Murat",
      description: "Hobbywerkstatt mit Basis-Ausstattung.",
      location: "Neufreimann Block A",
      maxCapacity: 3,
      imageUrls: ["https://picsum.photos/seed/workshop1/600/300"],
      toolIds: ["t2"],
    },
  ],
  slots: [
    {
      id: "s1",
      workshopId: "w1",
      startIso: now.toISOString(),
      endIso: inTwoDays.toISOString(),
      blockedByOwner: false,
    },
  ],
  bookings: [],
  notifications: [],
  reports: [],
  ratings: [],
  rules: [
    { id: "r1", text: "Werkzeuge müssen gereinigt zurückgegeben werden." },
    { id: "r2", text: "Rückgaben sind pünktlich zum vereinbarten Zeitpunkt durchzuführen." },
  ],
};

export function loadDb(): AppDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DB));
    return structuredClone(DEFAULT_DB);
  }
  return JSON.parse(raw) as AppDb;
}

export function saveDb(db: AppDb): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function resetDb(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DB));
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
