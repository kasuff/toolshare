export type WorkshopManagerEntity = {
  id: string;
  name: string;
  isSuspended?: boolean;
};

export type WorkshopToolEntity = {
  id: string;
  name: string;
  category: string;
};

export type WorkshopTimeslotEntity = {
  id: string;
  workshopId: string;
  startTime: Date;
  endTime: Date;
  blockedByOwner: boolean;
};

export type WorkshopBookingRangeEntity = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";
};

export type WorkshopEntity = {
  id: string;
  managerId: string;
  manager?: WorkshopManagerEntity | null;
  name: string;
  description: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  maxCapacity: number;
  // Prisma-Spalte heisst `equipment`; der Wire-Vertrag nutzt `extras`.
  equipment?: string[];
  extras?: string[];
  imageUrls?: string[];
  workshopTools?: WorkshopToolEntity[];
  timeslots?: WorkshopTimeslotEntity[];
  bookings?: WorkshopBookingRangeEntity[];
};