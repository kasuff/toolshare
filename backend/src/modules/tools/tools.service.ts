import { AppError } from "../../utils/app-error";
import { toolsRepository } from "./tools.repository";

const canModerate = (role: "USER" | "MODERATOR" | "MANAGER") => {
  return role === "MODERATOR" || role === "MANAGER";
};

export const toolsService = {
  list(filters: {
    category?: string;
    status?: "AVAILABLE" | "REQUESTED" | "BORROWED";
    ownerId?: string;
    search?: string;
  }) {
    return toolsRepository.list({
      ...filters,
      excludeSuspendedOwners: !filters.ownerId
    });
  },

  async getById(id: string) {
    const tool = await toolsRepository.findById(id);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    if (tool.owner.isSuspended) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    // Belegte Zeiträume mitliefern, damit der Kalender gebuchte Tage durchstreichen kann.
    const bookings = await toolsRepository.findActiveBookingRanges(id);
    return { ...tool, bookings };
  },

  async listBlockingPeriods(id: string) {
    const tool = await toolsRepository.findById(id);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    return toolsRepository.listBlockingPeriods(id);
  },

  async listOwnerBlocks(id: string, requesterId: string) {
    const tool = await toolsRepository.findById(id);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    if (tool.ownerId !== requesterId) {
      throw new AppError("FORBIDDEN", "Only the tool owner can view its blocks", 403);
    }
    return toolsRepository.listOwnerBlocks(id, requesterId);
  },

  async deleteOwnerBlock(input: { toolId: string; bookingId: string; actorId: string }) {
    const tool = await toolsRepository.findById(input.toolId);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    if (tool.ownerId !== input.actorId) {
      throw new AppError("FORBIDDEN", "Only the tool owner can delete its blocks", 403);
    }
    const result = await toolsRepository.deleteOwnerBlock(input.bookingId, input.actorId);
    if (result === "NOT_FOUND") {
      throw new AppError("BLOCK_NOT_FOUND", "Block not found", 404);
    }
    if (result === "FORBIDDEN") {
      throw new AppError("FORBIDDEN", "Only the tool owner can delete its blocks", 403);
    }
  },

  create(input: {
    ownerId: string;
    name: string;
    description: string;
    category: string;
    imageUrl?: string;
    pickupLocation: string;
    pickupLocationNote?: string;
  }) {
    return toolsRepository.create(input);
  },

  async update(input: {
    toolId: string;
    actorId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
    data: {
      name?: string;
      description?: string;
      category?: string;
      imageUrl?: string;
      pickupLocation?: string;
      pickupLocationNote?: string;
      status?: "AVAILABLE" | "REQUESTED" | "BORROWED";
    };
  }) {
    const tool = await toolsRepository.findById(input.toolId);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }

    const isOwner = tool.ownerId === input.actorId;
    if (!isOwner && !canModerate(input.actorRole)) {
      throw new AppError("FORBIDDEN", "Only owner or moderation roles can update this tool", 403);
    }

    return toolsRepository.update(input.toolId, input.data);
  },

  async remove(input: {
    toolId: string;
    actorId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
  }) {
    const tool = await toolsRepository.findById(input.toolId);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }

    const isOwner = tool.ownerId === input.actorId;
    if (!isOwner && !canModerate(input.actorRole)) {
      throw new AppError("FORBIDDEN", "Only owner or moderation roles can delete this tool", 403);
    }

    const activeBooking = await toolsRepository.findActiveBooking(input.toolId);
    if (activeBooking) {
      throw new AppError("ACTIVE_BOOKING_EXISTS", "Tool has active bookings and cannot be deleted", 409);
    }

    await toolsRepository.remove(input.toolId);
  }
};
