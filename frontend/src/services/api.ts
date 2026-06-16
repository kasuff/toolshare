import type {
  Booking,
  BookingSelectedTool,
  BookingStatus,
  PickupProposal,
  TimeslotProposal,
  Tool,
  User,
  Workshop,
  WorkshopSlot
} from "../types/domain";
import { DEFAULT_PLACEHOLDER_IMAGE, normalizePlaceholderImage } from "../utils/categories";
import { beginRequestActivity } from "./requestActivity";
import { notifySessionExpired, SESSION_EXPIRED_MESSAGE } from "./sessionEvents";

interface FrontendImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface FrontendImportMeta {
  readonly env: FrontendImportMetaEnv;
}

const API_BASE = ((import.meta as unknown as FrontendImportMeta).env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api";

type BackendRole = "USER" | "MODERATOR" | "MANAGER";
type BackendToolStatus = "AVAILABLE" | "REQUESTED" | "BORROWED";
type BackendBookingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";
type BackendUser = {
  id: string;
  email: string;
  name: string;
  address?: string;
  avatarUrl?: string | null;
  role: BackendRole;
  isSuspended: boolean;
};
type BackendMetrics = {
  users: number;
  tools: number;
  workshops: number;
  openBookings: number;
  openReports: number;
  openSuspensionRequests: number;
};

export type ModerationReport = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: "TOOL" | "WORKSHOP" | "USER";
  targetId: string;
  targetLabel: string;
  targetHref: string | null;
  subjectUserId: string | null;
  subjectUserName: string | null;
  reason: string;
  details?: string;
  conversationContext?: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  decisionNote?: string | null;
  decisionAt?: string | null;
  moderatorId?: string | null;
  moderatorName?: string | null;
  createdAt: string;
};

export type SuspensionRequestItem = {
  id: string;
  userId: string;
  requestedById: string;
  reportId: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: { id: string; name: string; email: string; isSuspended: boolean };
  requestedBy: { id: string; name: string };
  report?: { id: string; reason: string; targetType: string; targetId: string } | null;
};

export type AddressSuggestion = {
  label: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

type AuthPayload = {
  user: {
    id: string;
    email: string;
    name: string;
    address?: string;
    role: BackendRole;
    isSuspended?: boolean;
  };
  accessToken: string;
  refreshToken: string;
};

type BackendTool = {
  id: string;
  ownerId: string;
  owner?: Pick<BackendUser, "id" | "name"> | null;
  name: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  pickupLocation?: string | null;
  pickupLocationNote?: string | null;
  status: BackendToolStatus;
};

type BackendWorkshop = {
  id: string;
  managerId: string;
  manager?: Pick<BackendUser, "id" | "name"> | null;
  name: string;
  description: string;
  location: string;
  maxCapacity: number;
  equipment?: string[];
  extras?: string[];
  imageUrls?: string[];
  workshopTools?: BackendWorkshopTool[];
  timeslots?: BackendWorkshopTimeslot[];
};

type BackendWorkshopTool = {
  id: string;
  workshopId?: string;
  name: string;
  category: string;
  status?: BackendToolStatus;
};

type BackendWorkshopTimeslot = {
  id: string;
  workshopId: string;
  startTime: string;
  endTime: string;
  blockedByOwner?: boolean;
};

type BackendPickupProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED";

type BackendPickupProposal = {
  id: string;
  bookingId: string;
  proposedByUserId: string;
  proposedPickupTime: string;
  proposedReturnTime: string | null;
  previousPickupTime: string | null;
  previousReturnTime: string | null;
  status: BackendPickupProposalStatus;
  createdAt: string;
};

type BackendTimeslotProposal = {
  id: string;
  bookingId: string;
  proposedByUserId: string;
  proposedStartDate: string;
  proposedEndDate: string;
  previousStartDate: string | null;
  previousEndDate: string | null;
  status: BackendPickupProposalStatus;
  createdAt: string;
};

type BackendBooking = {
  id: string;
  userId: string;
  toolId?: string | null;
  timeslotId?: string | null;
  startDate: string;
  endDate: string;
  pickupTime?: string | null;
  createdAt?: string;
  status: BackendBookingStatus;
  user?: BackendUser | null;
  tool?: (BackendTool & { owner?: BackendUser | null }) | null;
  timeslot?: {
    id: string;
    workshopId: string;
    startTime: string;
    endTime: string;
    workshop?: {
      id: string;
      name: string;
      managerId: string;
      manager?: BackendUser | null;
    } | null;
  } | null;
  selectedTools?: Array<{
    workshopToolId: string;
    workshopTool: BackendWorkshopTool;
  }>;
  pickupProposals?: BackendPickupProposal[];
  timeslotProposals?: BackendTimeslotProposal[];
};

const roleMap: Record<BackendRole, User["role"]> = {
  USER: "NUTZER",
  MODERATOR: "MODERATOR",
  MANAGER: "ADMIN"
};

const toolStatusMap: Record<BackendToolStatus, Tool["status"]> = {
  AVAILABLE: "VERFUEGBAR",
  REQUESTED: "AUSGELIEHEN",
  BORROWED: "AUSGELIEHEN"
};

const bookingStatusMap: Record<BackendBookingStatus, BookingStatus> = {
  PENDING: "OFFEN",
  ACCEPTED: "BESTAETIGT",
  REJECTED: "ABGELEHNT",
  RETURNED: "ABGESCHLOSSEN"
};

const bookingStatusReverseMap: Record<BookingStatus, BackendBookingStatus> = {
  OFFEN: "PENDING",
  BESTAETIGT: "ACCEPTED",
  ABGELEHNT: "REJECTED",
  ABGESCHLOSSEN: "RETURNED"
};

function toLocalDateTimeInputValue(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function translateValidationMessage(raw: string): string {
  const minCharsMatch = raw.match(/at least (\d+) character/i);
  if (raw.includes("at least 8 character") || raw.match(/at least 8/i)) {
    return "Passwort muss mindestens 8 Zeichen lang sein.";
  }
  if (minCharsMatch) {
    return `Eingabe muss mindestens ${minCharsMatch[1]} Zeichen lang sein.`;
  }
  if (/invalid.*uuid/i.test(raw)) return "Ungültige ID.";
  if (/invalid.*email/i.test(raw)) return "Ungültige E-Mail-Adresse.";
  if (/invalid.*datetime/i.test(raw)) return "Ungültiges Datum oder Uhrzeit.";
  if (/required/i.test(raw)) return "Pflichtfeld fehlt.";
  if (/expected string/i.test(raw)) return "Text erwartet.";
  if (/expected number/i.test(raw)) return "Zahl erwartet.";
  if (/expected boolean/i.test(raw)) return "Ja/Nein-Wert erwartet.";
  if (raw.includes("Mindestens ein Feld")) return raw;
  if (raw.includes("Ungültig")) return raw;
  return raw;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const finishActivity = beginRequestActivity();
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {})
        }
      });
    } catch {
      throw new Error("Netzwerkfehler: Bitte Verbindung prüfen und erneut versuchen.");
    }

    if (response.status === 401 && token) {
      notifySessionExpired();
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }

    if (!response.ok) {
      let message = `Anfrage fehlgeschlagen (Fehler ${response.status}).`;
      try {
        const payload = (await response.json()) as {
          message?: string;
          error?: {
            message?: string;
            code?: string;
            details?: {
              fieldErrors?: Record<string, string[] | undefined>;
              formErrors?: string[];
            };
          };
        };
        if (payload.error?.message) {
          message = payload.error.message;
        } else if (payload.message) {
          message = payload.message;
        }
        if (payload.error?.code === "EMAIL_ALREADY_EXISTS") {
          message = "Diese E-Mail ist bereits registriert.";
        }
        const fieldErrorEntries = payload.error?.details?.fieldErrors
          ? Object.entries(payload.error.details.fieldErrors).filter(([, errors]) => Boolean(errors?.length))
          : [];
        if (fieldErrorEntries.length > 0) {
          const [field, errors] = fieldErrorEntries[0];
          const rawError = errors?.[0] ?? "Ungültige Eingabe.";
          const translated = translateValidationMessage(rawError);
          message = field === "body" ? translated : `${field}: ${translated}`;
        } else if (payload.error?.details?.formErrors?.length) {
          message = translateValidationMessage(payload.error.details.formErrors[0]);
        }
      } catch {
        // keep fallback message
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    finishActivity();
  }
}

function mapTool(tool: BackendTool): Tool {
  return {
    id: tool.id,
    ownerId: tool.ownerId,
    ownerName: tool.owner?.name,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    status: toolStatusMap[tool.status],
    imageUrl: normalizePlaceholderImage(tool.imageUrl),
    pickupLocation: tool.pickupLocation ?? "",
    pickupLocationNote: tool.pickupLocationNote ?? undefined
  };
}

function mapWorkshop(workshop: BackendWorkshop): Workshop {
  const extras = workshop.extras ?? workshop.equipment ?? [];
  return {
    id: workshop.id,
    ownerId: workshop.managerId,
    ownerName: workshop.manager?.name,
    name: workshop.name,
    description: workshop.description,
    location: workshop.location,
    maxCapacity: workshop.maxCapacity,
    extras,
    equipmentItems: (workshop.workshopTools ?? []).map((tool) => ({
      id: tool.id,
      name: tool.name,
      category: tool.category
    })),
    imageUrls:
      workshop.imageUrls && workshop.imageUrls.length > 0
        ? workshop.imageUrls.map(normalizePlaceholderImage)
        : [DEFAULT_PLACEHOLDER_IMAGE],
    toolIds: []
  };
}

function mapWorkshopSlot(slot: BackendWorkshopTimeslot): WorkshopSlot {
  return {
    id: slot.id,
    workshopId: slot.workshopId,
    startIso: toLocalDateTimeInputValue(slot.startTime),
    endIso: toLocalDateTimeInputValue(slot.endTime),
    blockedByOwner: Boolean(slot.blockedByOwner)
  };
}

function mapPickupProposal(p: BackendPickupProposal): PickupProposal {
  return {
    id: p.id,
    proposedById: p.proposedByUserId,
    proposedPickupIso: p.proposedPickupTime,
    proposedReturnIso: p.proposedReturnTime ?? undefined,
    previousPickupIso: p.previousPickupTime ?? undefined,
    previousReturnIso: p.previousReturnTime ?? undefined,
    status: p.status,
    createdIso: p.createdAt
  };
}

function mapTimeslotProposal(p: BackendTimeslotProposal): TimeslotProposal {
  return {
    id: p.id,
    proposedById: p.proposedByUserId,
    proposedStartIso: p.proposedStartDate,
    proposedEndIso: p.proposedEndDate,
    previousStartIso: p.previousStartDate ?? undefined,
    previousEndIso: p.previousEndDate ?? undefined,
    status: p.status,
    createdIso: p.createdAt
  };
}

function mapBooking(booking: BackendBooking): Booking {
  const tool = booking.tool;
  const workshop = booking.timeslot?.workshop;

  const providerId = tool?.ownerId ?? workshop?.managerId ?? "";
  const requesterName = booking.user?.name;
  const providerName = tool?.owner?.name ?? workshop?.manager?.name;

  let toolName: string | undefined;
  let toolImageUrl: string | undefined;
  if (tool) {
    toolName = tool.name;
    toolImageUrl = tool.imageUrl ?? undefined;
  } else if (workshop) {
    toolName = workshop.name;
  }

  const selectedWorkshopTools: BookingSelectedTool[] = (booking.selectedTools ?? []).map((selected) => ({
    id: selected.workshopTool.id,
    name: selected.workshopTool.name,
    category: selected.workshopTool.category
  }));

  return {
    id: booking.id,
    type: booking.toolId ? "TOOL" : "WORKSHOP",
    requesterId: booking.userId,
    providerId,
    toolId: booking.toolId ?? undefined,
    workshopId: workshop?.id,
    slotId: booking.timeslotId ?? undefined,
    startIso: booking.startDate,
    endIso: booking.endDate,
    pickupTimeIso: booking.pickupTime ?? undefined,
    status: bookingStatusMap[booking.status],
    createdIso: booking.createdAt ?? booking.startDate,
    requesterName,
    providerName,
    toolName,
    toolImageUrl,
    pickupProposals: (booking.pickupProposals ?? []).map(mapPickupProposal),
    timeslotProposals: (booking.timeslotProposals ?? []).map(mapTimeslotProposal),
    selectedWorkshopTools
  };
}

export const api = {
  async login(email: string, password: string): Promise<AuthPayload> {
    return request<AuthPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async register(input: { email: string; password: string; name: string; address: string }) {
    return request<AuthPayload>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async suggestAddresses(query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < 3) return [];
    try {
      const response = await request<{ suggestions: AddressSuggestion[] }>(
        `/address/suggest?q=${encodeURIComponent(query.trim())}`
      );
      return response.suggestions;
    } catch {
      return [];
    }
  },

  async validateAddress(query: string): Promise<{
    isValid: boolean;
    normalizedAddress: string | null;
    normalizedParts: AddressSuggestion | null;
  }> {
    if (query.trim().length < 5) {
      return { isValid: false, normalizedAddress: null, normalizedParts: null };
    }
    try {
      return await request<{ isValid: boolean; normalizedAddress: string | null; normalizedParts: AddressSuggestion | null }>(
        `/address/validate?q=${encodeURIComponent(query.trim())}`
      );
    } catch {
      // Do not hard-block registration/profile save if provider is unavailable.
      return { isValid: true, normalizedAddress: null, normalizedParts: null };
    }
  },

  async getCurrentUser(token: string): Promise<User> {
    const user = await request<BackendUser>("/users/me", undefined, token);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: roleMap[user.role],
      isSuspended: user.isSuspended ?? false
    };
  },

  async listUsers(
    token: string,
    filters: { search?: string; role?: "NUTZER" | "MODERATOR" | "ADMIN" } = {}
  ): Promise<User[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.role) {
      params.set("role", filters.role === "ADMIN" ? "MANAGER" : filters.role === "MODERATOR" ? "MODERATOR" : "USER");
    }

    const query = params.toString();
    const users = await request<BackendUser[]>(query ? `/users?${query}` : "/users", undefined, token);
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleMap[user.role],
      isSuspended: user.isSuspended
    }));
  },

  async updateUserRole(userId: string, role: "NUTZER" | "MODERATOR" | "ADMIN", token: string) {
    const backendRole: BackendRole = role === "ADMIN" ? "MANAGER" : role === "MODERATOR" ? "MODERATOR" : "USER";
    await request(
      `/users/${userId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: backendRole })
      },
      token
    );
  },

  async updateUserSuspension(userId: string, isSuspended: boolean, token: string) {
    await request(
      `/users/${userId}/suspension`,
      {
        method: "PATCH",
        body: JSON.stringify({ isSuspended })
      },
      token
    );
  },

  async updateMyProfile(input: { name?: string; address?: string }, token: string): Promise<User> {
    const user = await request<BackendUser>(
      "/users/me",
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: roleMap[user.role],
      isSuspended: user.isSuspended
    };
  },

  async getTools(
    filters: { q?: string; category?: string; ownerId?: string; status?: "VERFUEGBAR" | "AUSGELIEHEN" },
    token: string
  ): Promise<Tool[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.ownerId) params.set("ownerId", filters.ownerId);
    if (filters.status) {
      const backendStatus = filters.status === "VERFUEGBAR" ? "AVAILABLE" : "BORROWED";
      params.set("status", backendStatus);
    }
    const tools = await request<BackendTool[]>(`/tools?${params.toString()}`, undefined, token);
    return tools.map(mapTool);
  },

  async createTool(
    input: {
      name: string;
      description: string;
      category: string;
      imageUrl?: string;
      pickupLocation: string;
      pickupLocationNote?: string;
    },
    token: string
  ): Promise<Tool> {
    const created = await request<BackendTool>(
      "/tools",
      {
        method: "POST",
        body: JSON.stringify({
          ...input,
          pickupLocationNote: input.pickupLocationNote?.trim() || undefined
        })
      },
      token
    );
    return mapTool(created);
  },

  async updateTool(
    toolId: string,
    input: {
      name: string;
      description: string;
      category: string;
      imageUrl?: string;
      pickupLocation: string;
      pickupLocationNote?: string;
    },
    token: string
  ): Promise<Tool> {
    const updated = await request<BackendTool>(
      `/tools/${toolId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );
    return mapTool(updated);
  },

  async deleteTool(toolId: string, token: string) {
    await request<void>(`/tools/${toolId}`, { method: "DELETE" }, token);
  },

  async getToolBlockingPeriods(
    toolId: string
  ): Promise<Array<{ startIso: string; endIso: string }>> {
    const periods = await request<Array<{ startDate: string; endDate: string }>>(
      `/tools/${toolId}/blocking-periods`
    );
    return periods.map((period) => ({
      startIso: period.startDate,
      endIso: period.endDate
    }));
  },

  async createToolOwnerBlock(
    input: { toolId: string; startIso: string; endIso: string },
    token: string
  ): Promise<Booking> {
    const created = await request<BackendBooking>(
      "/bookings/tool-owner-block",
      {
        method: "POST",
        body: JSON.stringify({
          toolId: input.toolId,
          startDate: new Date(input.startIso).toISOString(),
          endDate: new Date(input.endIso).toISOString()
        })
      },
      token
    );
    return mapBooking(created);
  },

  async createToolRequest(
    input: { toolId: string; startIso: string; endIso: string; pickupTimeIso: string },
    token: string
  ): Promise<Booking> {
    const created = await request<BackendBooking>(
      "/bookings/tool",
      {
        method: "POST",
        body: JSON.stringify({
          toolId: input.toolId,
          startDate: new Date(input.startIso).toISOString(),
          endDate: new Date(input.endIso).toISOString(),
          pickupTime: new Date(input.pickupTimeIso).toISOString()
        })
      },
      token
    );
    return mapBooking(created);
  },

  async getWorkshops(
    filters: { q?: string; managerId?: string },
    token: string
  ): Promise<Array<{ workshop: Workshop; slots: WorkshopSlot[]; tools: Array<Tool & { selectable: boolean }> }>> {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    if (filters.managerId) params.set("managerId", filters.managerId);
    const workshops = await request<BackendWorkshop[]>(`/workshops?${params.toString()}`, undefined, token);
    const withSlots = await Promise.all(
      workshops.map(async (workshop) => {
        const detail = await request<BackendWorkshop>(`/workshops/${workshop.id}`, undefined, token);
        const slots = (detail.timeslots ?? []).map(mapWorkshopSlot);
        const mappedWorkshop = mapWorkshop(detail);
        const tools = mappedWorkshop.equipmentItems.map((tool) => {
          const backendTool = detail.workshopTools?.find((entry) => entry.id === tool.id);
          const status = backendTool?.status ? toolStatusMap[backendTool.status] : ("VERFUEGBAR" as const);
          return {
            id: tool.id,
            ownerId: mappedWorkshop.ownerId,
            name: tool.name,
            description: "Werkstatt-Werkzeug",
            category: tool.category,
            imageUrl: DEFAULT_PLACEHOLDER_IMAGE,
            status,
            selectable: status === "VERFUEGBAR",
          };
        });
        return { workshop: mappedWorkshop, slots, tools };
      })
    );
    return withSlots;
  },

  async getWorkshopById(workshopId: string, token: string): Promise<{ workshop: Workshop; slots: WorkshopSlot[] }> {
    const detail = await request<BackendWorkshop>(`/workshops/${workshopId}`, undefined, token);
    return {
      workshop: mapWorkshop(detail),
      slots: (detail.timeslots ?? []).map(mapWorkshopSlot)
    };
  },

  async createWorkshop(
    input: {
      name: string;
      description: string;
      location: string;
      maxCapacity: number;
      extras?: string[];
      equipmentItems?: Array<{ name: string; category: string }>;
      imageUrls?: string[];
      slots: Array<{ startIso: string; endIso: string; blockedByOwner?: boolean }>;
    },
    token: string
  ) {
    const workshop = await request<BackendWorkshop>(
      "/workshops",
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          location: input.location,
          maxCapacity: input.maxCapacity,
          extras: input.extras ?? [],
          workshopTools: (input.equipmentItems ?? []).map((tool) => ({
            name: tool.name,
            category: tool.category
          })),
          imageUrls: input.imageUrls ?? []
        })
      },
      token
    );

    await Promise.all(
      input.slots.map((slot) =>
        request(
          `/workshops/${workshop.id}/timeslots`,
          {
            method: "POST",
            body: JSON.stringify({
              startTime: new Date(slot.startIso).toISOString(),
              endTime: new Date(slot.endIso).toISOString(),
              blockedByOwner: Boolean(slot.blockedByOwner)
            })
          },
          token
        )
      )
    );

    return mapWorkshop(workshop);
  },

  async updateWorkshop(
    workshopId: string,
    input: {
      name: string;
      description?: string;
      location: string;
      maxCapacity: number;
      extras?: string[];
      equipmentItems?: Array<{ name: string; category: string }>;
      imageUrls?: string[];
    },
    token: string
  ): Promise<Workshop> {
    const updated = await request<BackendWorkshop>(
      `/workshops/${workshopId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          location: input.location,
          maxCapacity: input.maxCapacity,
          extras: input.extras ?? [],
          workshopTools: (input.equipmentItems ?? []).map((tool) => ({
            name: tool.name,
            category: tool.category
          })),
          imageUrls: input.imageUrls ?? []
        })
      },
      token
    );
    return mapWorkshop(updated);
  },

  async deleteWorkshop(workshopId: string, token: string) {
    await request<void>(`/workshops/${workshopId}`, { method: "DELETE" }, token);
  },

  async createWorkshopTimeslot(
    workshopId: string,
    input: { startIso: string; endIso: string; blockedByOwner?: boolean },
    token: string
  ): Promise<WorkshopSlot> {
    const created = await request<BackendWorkshopTimeslot>(
      `/workshops/${workshopId}/timeslots`,
      {
        method: "POST",
        body: JSON.stringify({
          startTime: new Date(input.startIso).toISOString(),
          endTime: new Date(input.endIso).toISOString(),
          blockedByOwner: Boolean(input.blockedByOwner)
        })
      },
      token
    );
    return mapWorkshopSlot(created);
  },

  async updateWorkshopTimeslot(
    workshopId: string,
    timeslotId: string,
    input: { startIso?: string; endIso?: string; blockedByOwner?: boolean },
    token: string
  ): Promise<WorkshopSlot> {
    const payload: { startTime?: string; endTime?: string; blockedByOwner?: boolean } = {};
    if (input.startIso) payload.startTime = new Date(input.startIso).toISOString();
    if (input.endIso) payload.endTime = new Date(input.endIso).toISOString();
    if (typeof input.blockedByOwner === "boolean") payload.blockedByOwner = input.blockedByOwner;

    const updated = await request<BackendWorkshopTimeslot>(
      `/workshops/${workshopId}/timeslots/${timeslotId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      token
    );
    return mapWorkshopSlot(updated);
  },

  async deleteWorkshopTimeslot(workshopId: string, timeslotId: string, token: string) {
    await request<void>(
      `/workshops/${workshopId}/timeslots/${timeslotId}`,
      {
        method: "DELETE"
      },
      token
    );
  },

  async createWorkshopBooking(
    input: { workshopId: string; startIso: string; endIso: string; workshopToolIds: string[] },
    token: string
  ) {
    const booking = await request<BackendBooking>(
      "/bookings/workshop",
      {
        method: "POST",
        body: JSON.stringify({
          workshopId: input.workshopId,
          startDate: new Date(input.startIso).toISOString(),
          endDate: new Date(input.endIso).toISOString(),
          workshopToolIds: input.workshopToolIds
        })
      },
      token
    );
    return mapBooking(booking);
  },

  async getBookingsForUser(token: string): Promise<Booking[]> {
    const bookings = await request<BackendBooking[]>("/bookings/me", undefined, token);
    return bookings.map(mapBooking);
  },

  async decideBooking(bookingId: string, status: BookingStatus, token: string) {
    await request(
      `/bookings/${bookingId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: bookingStatusReverseMap[status] })
      },
      token
    );
  },

  async createPickupProposal(bookingId: string, pickupTimeIso: string, returnTimeIso: string, token: string) {
    const pickup = new Date(pickupTimeIso);
    const returnTime = new Date(returnTimeIso);
    if (
      Number.isNaN(pickup.getTime()) ||
      Number.isNaN(returnTime.getTime()) ||
      pickup >= returnTime
    ) {
      throw new Error("Ungültiger Abhol- oder Rückgabezeitpunkt.");
    }
    await request(
      `/bookings/${bookingId}/pickup-proposals`,
      {
        method: "POST",
        body: JSON.stringify({
          pickupTime: pickup.toISOString(),
          returnTime: returnTime.toISOString()
        })
      },
      token
    );
  },

  async respondPickupProposal(
    bookingId: string,
    proposalId: string,
    decision: "ACCEPT" | "DECLINE",
    token: string
  ) {
    await request(
      `/bookings/${bookingId}/pickup-proposals/${proposalId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision })
      },
      token
    );
  },

  async createTimeslotProposal(bookingId: string, startIso: string, endIso: string, token: string) {
    await request(
      `/bookings/${bookingId}/timeslot-proposals`,
      {
        method: "POST",
        body: JSON.stringify({
          startDate: new Date(startIso).toISOString(),
          endDate: new Date(endIso).toISOString()
        })
      },
      token
    );
  },

  async respondTimeslotProposal(
    bookingId: string,
    proposalId: string,
    decision: "ACCEPT" | "DECLINE",
    token: string
  ) {
    await request(
      `/bookings/${bookingId}/timeslot-proposals/${proposalId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision })
      },
      token
    );
  },

  async getNotifications(token: string) {
    const notifications = await request<Array<{ id: string; userId: string; message: string; read: boolean; createdAt: string }>>(
      "/notifications/me",
      undefined,
      token
    );
    return notifications.map((n) => ({ ...n, createdIso: n.createdAt }));
  },

  async listReports(token: string) {
    return request<ModerationReport[]>("/moderation/reports", undefined, token);
  },

  async listClosedReports(token: string) {
    return request<ModerationReport[]>("/moderation/reports/closed", undefined, token);
  },

  async createReport(
    input: {
      targetType: "TOOL" | "WORKSHOP" | "USER";
      targetId: string;
      reason: string;
      details?: string;
      bookingId?: string;
      conversationContext?: string;
    },
    token: string
  ) {
    return request(
      "/moderation/reports",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      token
    );
  },

  async updateReportStatus(
    reportId: string,
    input: {
      status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
      decisionNote?: string;
      warnUserId?: string;
      warningReason?: string;
      requestSuspensionUserId?: string;
      suspensionReason?: string;
    },
    token: string
  ) {
    await request(
      `/moderation/reports/${reportId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );
  },

  async listSuspensionRequests(token: string) {
    return request<SuspensionRequestItem[]>("/users/admin/suspension-requests", undefined, token);
  },

  async decideSuspensionRequest(
    requestId: string,
    input: { approve: boolean; decisionNote?: string },
    token: string
  ) {
    return request<SuspensionRequestItem>(
      `/users/admin/suspension-requests/${requestId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );
  },

  async getRatingsReceived(token: string) {
    return request<Array<{ id: string; score: number; comment?: string; createdAt: string; fromUser?: { name?: string } }>>(
      "/ratings/me/received",
      undefined,
      token
    );
  },

  async getMetrics(token: string): Promise<BackendMetrics> {
    return request<BackendMetrics>("/users/admin/metrics", undefined, token);
  }
};
