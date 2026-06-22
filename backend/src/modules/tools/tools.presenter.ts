import type { ToolEntity } from "./tools.entity";

export type ToolResponse = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  pickupLocation: string | null;
  pickupLocationNote: string | null;
  status: ToolEntity["status"];
  createdAt: string;
  updatedAt: string;
  owner: ToolEntity["owner"];
  bookings?: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: ToolBookingRangeResponse["status"];
  }>;
};

type ToolBookingRangeResponse = NonNullable<ToolResponse["bookings"]>[number];

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
    status: tool.status,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
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
