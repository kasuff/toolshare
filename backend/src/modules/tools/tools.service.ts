import { AppError } from "../../utils/app-error";
import { getImageStorageService } from "../../config/services";
import { resolveImageReference } from "../../ports/image-storage.service";
import { addressService } from "../address/address.service";
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
    return toolsRepository
      .list({
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
    const bookings = await toolsRepository.findActiveBookingRanges(id);
    return { ...tool, bookings };
  },

  async listBlockingPeriods(id: string) {
    const tool = await toolsRepository.findById(id);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    const periods = await toolsRepository.listBlockingPeriods(id);
    return periods;
  },

  async listOwnerBlocks(id: string, requesterId: string) {
    const tool = await toolsRepository.findById(id);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    if (tool.ownerId !== requesterId) {
      throw new AppError("FORBIDDEN", "Only the tool owner can view its blocks", 403);
    }
    const blocks = await toolsRepository.listOwnerBlocks(id, requesterId);
    return blocks;
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

  async create(input: {
    ownerId: string;
    name: string;
    description: string;
    category: string;
    imageUrl?: string;
    pickupLocation: string;
    pickupLocationNote?: string;
  }) {
    const storage = getImageStorageService();
    const imageUrl = await resolveImageReference(storage, input.imageUrl);
    const coordinates = await addressService.geocode(input.pickupLocation);
    const created = await toolsRepository.create({
      ...input,
      imageUrl,
      pickupLat: coordinates?.latitude ?? null,
      pickupLon: coordinates?.longitude ?? null
    });
    return created;
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

    const storage = getImageStorageService();
    const imageUrl =
      input.data.imageUrl !== undefined
        ? await resolveImageReference(storage, input.data.imageUrl)
        : undefined;

    const geo =
      input.data.pickupLocation !== undefined
        ? await addressService.geocode(input.data.pickupLocation)
        : null;

    const updated = await toolsRepository.update(input.toolId, {
      ...input.data,
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(input.data.pickupLocation !== undefined
        ? { pickupLat: geo?.latitude ?? null, pickupLon: geo?.longitude ?? null }
        : {})
    });
    return updated;
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
