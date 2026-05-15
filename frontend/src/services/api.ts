import type { Booking, BookingStatus, Tool, User, Workshop, WorkshopSlot } from "../types/domain";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../utils/categories";

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
  name: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  status: BackendToolStatus;
};

type BackendWorkshop = {
  id: string;
  managerId: string;
  name: string;
  description: string;
  location: string;
  maxCapacity: number;
  timeslots?: Array<{ id: string; workshopId: string; startTime: string; endTime: string }>;
};

type BackendBooking = {
  id: string;
  userId: string;
  toolId?: string | null;
  timeslotId?: string | null;
  startDate: string;
  endDate: string;
  pickupTime?: string | null;
  status: BackendBookingStatus;
  tool?: { ownerId: string } | null;
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

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
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

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
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
        const minCharsMatch = rawError.match(/at least (\d+) character/);
        if (field === "body") {
          if (rawError.includes("at least 8 character")) {
            message = "Passwort muss mindestens 8 Zeichen lang sein.";
          } else if (minCharsMatch) {
            message = `Eingabe muss mindestens ${minCharsMatch[1]} Zeichen lang sein.`;
          } else {
            message = rawError;
          }
        } else {
          message = minCharsMatch
            ? `${field}: Muss mindestens ${minCharsMatch[1]} Zeichen lang sein.`
            : `${field}: ${rawError}`;
        }
      } else if (payload.error?.details?.formErrors?.length) {
        message = payload.error.details.formErrors[0];
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function mapTool(tool: BackendTool): Tool {
  return {
    id: tool.id,
    ownerId: tool.ownerId,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    status: toolStatusMap[tool.status],
    imageUrl: tool.imageUrl ?? DEFAULT_PLACEHOLDER_IMAGE
  };
}

function mapWorkshop(workshop: BackendWorkshop): Workshop {
  return {
    id: workshop.id,
    ownerId: workshop.managerId,
    name: workshop.name,
    description: workshop.description,
    location: workshop.location,
    maxCapacity: workshop.maxCapacity,
    imageUrls: [DEFAULT_PLACEHOLDER_IMAGE],
    toolIds: []
  };
}

function mapWorkshopSlot(slot: { id: string; workshopId: string; startTime: string; endTime: string }): WorkshopSlot {
  return {
    id: slot.id,
    workshopId: slot.workshopId,
    startIso: toLocalDateTimeInputValue(slot.startTime),
    endIso: toLocalDateTimeInputValue(slot.endTime),
    blockedByOwner: false
  };
}

function mapBooking(booking: BackendBooking): Booking {
  return {
    id: booking.id,
    type: booking.toolId ? "TOOL" : "WORKSHOP",
    requesterId: booking.userId,
    providerId: booking.tool?.ownerId ?? "",
    toolId: booking.toolId ?? undefined,
    slotId: booking.timeslotId ?? undefined,
    startIso: booking.startDate,
    endIso: booking.endDate,
    pickupTimeIso: booking.pickupTime ?? undefined,
    status: bookingStatusMap[booking.status],
    createdIso: booking.startDate
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

  async getTools(filters: { q?: string; category?: string }, token: string): Promise<Tool[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    if (filters.category) params.set("category", filters.category);
    const tools = await request<BackendTool[]>(`/tools?${params.toString()}`, undefined, token);
    return tools.map(mapTool);
  },

  async createTool(
    input: { name: string; description: string; category: string; imageUrl?: string },
    token: string
  ): Promise<Tool> {
    const created = await request<BackendTool>(
      "/tools",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      token
    );
    return mapTool(created);
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

  async getWorkshops(filters: { q?: string }, token: string): Promise<Array<{ workshop: Workshop; slots: WorkshopSlot[] }>> {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    const workshops = await request<BackendWorkshop[]>(`/workshops?${params.toString()}`, undefined, token);
    const withSlots = await Promise.all(
      workshops.map(async (workshop) => {
        const detail = await request<BackendWorkshop>(`/workshops/${workshop.id}`, undefined, token);
        const slots = (detail.timeslots ?? []).map(mapWorkshopSlot);
        return { workshop: mapWorkshop(workshop), slots };
      })
    );
    return withSlots;
  },

  async createWorkshop(
    input: { name: string; description: string; location: string; maxCapacity: number; slots: Array<{ startIso: string; endIso: string }> },
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
          maxCapacity: input.maxCapacity
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
              endTime: new Date(slot.endIso).toISOString()
            })
          },
          token
        )
      )
    );

    return mapWorkshop(workshop);
  },

  async createWorkshopBooking(input: { slotId: string }, token: string) {
    const booking = await request<BackendBooking>(
      "/bookings/workshop",
      {
        method: "POST",
        body: JSON.stringify({ timeslotId: input.slotId })
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

  async getNotifications(token: string) {
    const notifications = await request<Array<{ id: string; userId: string; message: string; read: boolean; createdAt: string }>>(
      "/notifications/me",
      undefined,
      token
    );
    return notifications.map((n) => ({ ...n, createdIso: n.createdAt }));
  },

  async listReports(token: string) {
    return request<Array<{ id: string; reason: string; details?: string; status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED" }>>(
      "/moderation/reports",
      undefined,
      token
    );
  },

  async updateReportStatus(reportId: string, status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED", token: string) {
    await request(
      `/moderation/reports/${reportId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
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
