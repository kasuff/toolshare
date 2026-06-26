import type { Booking, Tool } from "../../types/domain";
import { request, requestParsed } from "./client";
import { mapBooking, mapTool, mapPublicRating } from "./mappers";
import {
  toolResponseSchema,
  toolListResponseSchema,
  toolBlockingPeriodListResponseSchema,
  toolOwnerBlockListResponseSchema
} from "../../contracts/response/tools.schema";
import { bookingResponseSchema } from "../../contracts/response/bookings.schema";
import { publicRatingListResponseSchema } from "../../contracts/response/ratings.schema";

export const toolsApi = {
  async getTools(
    filters: { q?: string; category?: string; ownerId?: string; status?: "VERFUEGBAR" | "AUSGELIEHEN" },
    token: string
  ): Promise<Tool[]> {
    const params = new URLSearchParams();
    if (filters.q) params.set("search", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.ownerId) params.set("ownerId", filters.ownerId);
    if (filters.status) {
      params.set("status", filters.status === "VERFUEGBAR" ? "AVAILABLE" : "BORROWED");
    }
    const tools = await requestParsed(toolListResponseSchema, `/tools?${params.toString()}`, undefined, token);
    return tools.map(mapTool);
  },

  async createTool(
    input: { name: string; description: string; category: string; imageUrl?: string; pickupLocation: string; pickupLocationNote?: string },
    token: string
  ): Promise<Tool> {
    const created = await requestParsed(
      toolResponseSchema,
      "/tools",
      { method: "POST", body: JSON.stringify({ ...input, pickupLocationNote: input.pickupLocationNote?.trim() || undefined }) },
      token
    );
    return mapTool(created);
  },

  async getToolById(toolId: string, token: string): Promise<Tool> {
    const tool = await requestParsed(toolResponseSchema, `/tools/${toolId}`, undefined, token);
    return mapTool(tool);
  },

  async updateTool(
    toolId: string,
    input: { name: string; description: string; category: string; imageUrl?: string; pickupLocation: string; pickupLocationNote?: string },
    token: string
  ): Promise<Tool> {
    const updated = await requestParsed(
      toolResponseSchema,
      `/tools/${toolId}`,
      { method: "PATCH", body: JSON.stringify({ ...input, pickupLocationNote: input.pickupLocationNote?.trim() || undefined }) },
      token
    );
    return mapTool(updated);
  },

  async deleteTool(toolId: string, token: string) {
    await request<void>(`/tools/${toolId}`, { method: "DELETE" }, token);
  },

  async getToolBlockingPeriods(toolId: string): Promise<Array<{ startIso: string; endIso: string }>> {
    const periods = await requestParsed(toolBlockingPeriodListResponseSchema, `/tools/${toolId}/blocking-periods`);
    return periods.map((p) => ({ startIso: p.startDate, endIso: p.endDate }));
  },

  async getToolOwnerBlocks(toolId: string, token: string): Promise<Array<{ id: string; startIso: string; endIso: string }>> {
    const blocks = await requestParsed(toolOwnerBlockListResponseSchema, `/tools/${toolId}/owner-blocks`, {}, token);
    return blocks.map((b) => ({ id: b.id, startIso: b.startDate, endIso: b.endDate }));
  },

  async deleteToolOwnerBlock(toolId: string, bookingId: string, token: string) {
    await request<void>(`/tools/${toolId}/owner-blocks/${bookingId}`, { method: "DELETE" }, token);
  },

  async createToolOwnerBlock(input: { toolId: string; startIso: string; endIso: string }, token: string): Promise<Booking> {
    const created = await requestParsed(
      bookingResponseSchema,
      "/bookings/tool-owner-block",
      { method: "POST", body: JSON.stringify({ toolId: input.toolId, startDate: new Date(input.startIso).toISOString(), endDate: new Date(input.endIso).toISOString() }) },
      token
    );
    return mapBooking(created);
  },

  async createToolRequest(input: { toolId: string; startIso: string; endIso: string; pickupTimeIso: string }, token: string): Promise<Booking> {
    const created = await requestParsed(
      bookingResponseSchema,
      "/bookings/tool",
      { method: "POST", body: JSON.stringify({ toolId: input.toolId, startDate: new Date(input.startIso).toISOString(), endDate: new Date(input.endIso).toISOString(), pickupTime: new Date(input.pickupTimeIso).toISOString() }) },
      token
    );
    return mapBooking(created);
  },

  async getRatingsForTool(toolId: string) {
    const ratings = await requestParsed(publicRatingListResponseSchema, `/ratings/tools/${toolId}`);
    return ratings.map(mapPublicRating);
  }
};
