import type {
  ToolBlockingPeriodResponse,
  ToolOwnerBlockResponse,
  ToolResponse
} from "@toolshare/shared/contracts/response/tools.schema";
import type { ToolEntity } from "./tools.entity";

export type { ToolResponse };

export function toToolResponse(tool: ToolEntity): ToolResponse {
  return {
    id: tool.id,
    ownerId: tool.ownerId,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    imageUrl: tool.imageUrl,
    pickupLocation: tool.pickupLocation,
    pickupLocationNote: tool.pickupLocationNote,
    pickupLat: tool.pickupLat ?? null,
    pickupLon: tool.pickupLon ?? null,
    status: tool.status,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: (tool.updatedAt ?? tool.createdAt).toISOString(),
    owner: tool.owner,
    bookings: tool.bookings?.map((booking) => ({
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      status: booking.status
    }))
  };
}

export function toToolResponseList(tools: ToolEntity[]): ToolResponse[] {
  return tools.map(toToolResponse);
}

export function toToolBlockingPeriodResponse(period: {
  startDate: Date;
  endDate: Date;
}): ToolBlockingPeriodResponse {
  return {
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString()
  };
}

export function toToolBlockingPeriodResponseList(
  periods: Array<{ startDate: Date; endDate: Date }>
): ToolBlockingPeriodResponse[] {
  return periods.map(toToolBlockingPeriodResponse);
}

export function toToolOwnerBlockResponse(block: {
  id: string;
  startDate: Date;
  endDate: Date;
}): ToolOwnerBlockResponse {
  return {
    id: block.id,
    startDate: block.startDate.toISOString(),
    endDate: block.endDate.toISOString()
  };
}

export function toToolOwnerBlockResponseList(
  blocks: Array<{ id: string; startDate: Date; endDate: Date }>
): ToolOwnerBlockResponse[] {
  return blocks.map(toToolOwnerBlockResponse);
}
