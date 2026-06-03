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
    return toolsRepository.list(filters);
  },

  async getById(id: string) {
    const tool = await toolsRepository.findById(id);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    return tool;
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