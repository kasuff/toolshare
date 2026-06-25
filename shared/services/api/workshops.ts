import { DEFAULT_PLACEHOLDER_IMAGE } from "../../utils/categories";
import type { Tool, Workshop, WorkshopBookedRange, WorkshopSlot } from "../../types/domain";
import { request, requestParsed } from "./client";
import { mapBooking, mapWorkshop, mapWorkshopBookedRanges, mapWorkshopSlot, mapPublicRating } from "./mappers";
import { toolStatusMap } from "./mappers/roles";
import {
  workshopResponseSchema,
  workshopListResponseSchema,
  workshopTimeslotResponseSchema
} from "../../contracts/response/workshops.schema";
import { bookingResponseSchema } from "../../contracts/response/bookings.schema";
import { publicRatingListResponseSchema } from "../../contracts/response/ratings.schema";

export const workshopsApi = {
  async getWorkshops(
    filters: { q?: string; managerId?: string },
    token: string
  ): Promise<Array<{ workshop: Workshop; slots: WorkshopSlot[]; bookedRanges: WorkshopBookedRange[]; tools: Array<Tool & { selectable: boolean }> }>> {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    if (filters.managerId) params.set("managerId", filters.managerId);
    const workshops = await requestParsed(workshopListResponseSchema, `/workshops?${params.toString()}`, undefined, token);
    const withSlots = await Promise.all(
      workshops.map(async (workshop) => {
        const detail = await requestParsed(workshopResponseSchema, `/workshops/${workshop.id}`, undefined, token);
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
            selectable: status === "VERFUEGBAR"
          };
        });
        return { workshop: mappedWorkshop, slots, bookedRanges, tools };
      })
    );
    return withSlots;
  },

  async getWorkshopById(workshopId: string, token: string): Promise<{ workshop: Workshop; slots: WorkshopSlot[]; bookedRanges: WorkshopBookedRange[] }> {
    const detail = await requestParsed(workshopResponseSchema, `/workshops/${workshopId}`, undefined, token);
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
    const workshop = await requestParsed(
      workshopResponseSchema,
      "/workshops",
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          location: input.location,
          maxCapacity: input.maxCapacity,
          extras: input.extras ?? [],
          workshopTools: (input.equipmentItems ?? []).map((t) => ({ name: t.name, category: t.category })),
          imageUrls: input.imageUrls ?? []
        })
      },
      token
    );

    await Promise.all(
      input.slots.map((slot) =>
        request(
          `/workshops/${workshop.id}/timeslots`,
          { method: "POST", body: JSON.stringify({ startTime: new Date(slot.startIso).toISOString(), endTime: new Date(slot.endIso).toISOString(), blockedByOwner: Boolean(slot.blockedByOwner) }) },
          token
        )
      )
    );

    return mapWorkshop(workshop);
  },

  async updateWorkshop(
    workshopId: string,
    input: { name: string; description?: string; location: string; maxCapacity: number; extras?: string[]; equipmentItems?: Array<{ name: string; category: string }>; imageUrls?: string[] },
    token: string
  ): Promise<Workshop> {
    const updated = await requestParsed(
      workshopResponseSchema,
      `/workshops/${workshopId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          location: input.location,
          maxCapacity: input.maxCapacity,
          extras: input.extras ?? [],
          workshopTools: (input.equipmentItems ?? []).map((t) => ({ name: t.name, category: t.category })),
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

  async createWorkshopTimeslot(workshopId: string, input: { startIso: string; endIso: string; blockedByOwner?: boolean }, token: string): Promise<WorkshopSlot> {
    const created = await requestParsed(
      workshopTimeslotResponseSchema,
      `/workshops/${workshopId}/timeslots`,
      { method: "POST", body: JSON.stringify({ startTime: new Date(input.startIso).toISOString(), endTime: new Date(input.endIso).toISOString(), blockedByOwner: Boolean(input.blockedByOwner) }) },
      token
    );
    return mapWorkshopSlot(created);
  },

  async updateWorkshopTimeslot(workshopId: string, timeslotId: string, input: { startIso?: string; endIso?: string; blockedByOwner?: boolean }, token: string): Promise<WorkshopSlot> {
    const payload: { startTime?: string; endTime?: string; blockedByOwner?: boolean } = {};
    if (input.startIso) payload.startTime = new Date(input.startIso).toISOString();
    if (input.endIso) payload.endTime = new Date(input.endIso).toISOString();
    if (typeof input.blockedByOwner === "boolean") payload.blockedByOwner = input.blockedByOwner;
    const updated = await requestParsed(
      workshopTimeslotResponseSchema,
      `/workshops/${workshopId}/timeslots/${timeslotId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    );
    return mapWorkshopSlot(updated);
  },

  async deleteWorkshopTimeslot(workshopId: string, timeslotId: string, token: string) {
    await request<void>(`/workshops/${workshopId}/timeslots/${timeslotId}`, { method: "DELETE" }, token);
  },

  async createWorkshopBooking(input: { workshopId: string; startIso: string; endIso: string; workshopToolIds: string[] }, token: string) {
    const booking = await requestParsed(
      bookingResponseSchema,
      "/bookings/workshop",
      { method: "POST", body: JSON.stringify({ workshopId: input.workshopId, startDate: new Date(input.startIso).toISOString(), endDate: new Date(input.endIso).toISOString(), workshopToolIds: input.workshopToolIds }) },
      token
    );
    return mapBooking(booking);
  },

  async getRatingsForWorkshop(workshopId: string) {
    const ratings = await requestParsed(publicRatingListResponseSchema, `/ratings/workshops/${workshopId}`);
    return ratings.map(mapPublicRating);
  }
};
