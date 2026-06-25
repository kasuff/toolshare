export type ToolStatus = "AVAILABLE" | "REQUESTED" | "BORROWED";

export type ToolOwnerEntity = {
  id: string;
  name: string;
  role: "USER" | "MODERATOR" | "MANAGER";
  isSuspended: boolean;
};

export type ToolBookingRangeEntity = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";
};

export type ToolEntity = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  pickupLocation: string | null;
  pickupLocationNote: string | null;
  pickupLat?: number | null;
  pickupLon?: number | null;
  status: ToolStatus;
  createdAt: Date;
  updatedAt?: Date;
  owner: ToolOwnerEntity;
  bookings?: ToolBookingRangeEntity[];
};
