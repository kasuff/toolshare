import { DEFAULT_PLACEHOLDER_IMAGE } from "../../utils/categories";
import type { Tool, Workshop, WorkshopBookedRange, WorkshopSlot } from "../../types/domain";
import type { BackendBooking, BackendWorkshop, BackendWorkshopTimeslot } from "./types";
import { request } from "./client";
import { mapBooking, mapWorkshop, mapWorkshopBookedRanges, mapWorkshopSlot } from "./mappers";
import { toolStatusMap } from "./mappers/roles";

export const workshopsApi = {
  async getWorkshops(
    filters: { q?: string; managerId?: string },
    token: string
  ): Promise<
    Array<{
      workshop: Workshop;
      slots: WorkshopSlot[];
      bookedRanges: WorkshopBookedRange[];
      tools: Array<Tool & { selectable: boolean }>;
    }>
  > {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    if (filters.managerId) params.set("managerId", filters.managerId);
    const workshops = await request<BackendWorkshop[]>(`/workshops?${params.toString()}`, undefined, token);
    const withSlots = await Promise.all(
      workshops.map(async (workshop) => {
        const detail = await request<BackendWorkshop>(`/workshops/${workshop.id}`, undefined, token);
        const slots = (detail.timeslots ?? []).map(mapWorkshopSlot);
        const bookedRanges = mapWorkshopBookedRanges(detail.bookings);
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
        return { workshop: mappedWorkshop, slots, bookedRanges, tools };
      })
    );
    return withSlots;
  },

  async getWorkshopById(
    workshopId: string,
    token: string
  ): Promise<{ workshop: Workshop; slots: WorkshopSlot[]; bookedRanges: WorkshopBookedRange[] }> {
    const detail = await request<BackendWorkshop>(`/workshops/${workshopId}`, undefined, token);
    return {
      workshop: mapWorkshop(detail),
      slots: (detail.timeslots ?? []).map(mapWorkshopSlot),
      bookedRanges: mapWorkshopBookedRanges(detail.bookings)
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

  async getRatingsForWorkshop(workshopId: string) {
    const ratings = await request<BackendRating[]>(`/ratings/workshops/${workshopId}`);
    return ratings.map(mapPublicRating);
  },

};
