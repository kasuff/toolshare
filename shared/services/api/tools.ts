import type { Booking, Tool } from "../../types/domain";
import type { BackendBooking, BackendTool, BackendRating } from "./types";
import { request } from "./client";
import { mapBooking, mapTool, mapPublicRating } from "./mappers";

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

  async getToolById(toolId: string, token: string): Promise<Tool> {
    const tool = await request<BackendTool>(`/tools/${toolId}`, undefined, token);
    return mapTool(tool);
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
        body: JSON.stringify({
          ...input,
          pickupLocationNote: input.pickupLocationNote?.trim() || undefined
        })
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

  async getToolOwnerBlocks(
    toolId: string,
    token: string
  ): Promise<Array<{ id: string; startIso: string; endIso: string }>> {
    const blocks = await request<Array<{ id: string; startDate: string; endDate: string }>>(
      `/tools/${toolId}/owner-blocks`,
      {},
      token
    );
    return blocks.map((block) => ({
      id: block.id,
      startIso: block.startDate,
      endIso: block.endDate
    }));
  },

  async deleteToolOwnerBlock(toolId: string, bookingId: string, token: string) {
    await request<void>(`/tools/${toolId}/owner-blocks/${bookingId}`, { method: "DELETE" }, token);
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

  async getRatingsForTool(toolId: string) {
    const ratings = await request<BackendRating[]>(`/ratings/tools/${toolId}`);
    return ratings.map(mapPublicRating);
  },

};
