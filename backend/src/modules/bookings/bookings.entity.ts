export type BookingStatusValue = "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";
export type BookingProposalStatusValue = "PENDING" | "ACCEPTED" | "DECLINED";

export type UserRefEntity = {
  id: string;
  name: string;
};

export type BookingPickupProposalEntity = {
  id: string;
  bookingId: string;
  proposedByUserId: string;
  proposedPickupTime: Date;
  proposedReturnTime: Date | null;
  previousPickupTime: Date | null;
  previousReturnTime: Date | null;
  status: BookingProposalStatusValue;
  createdAt: Date;
};

export type BookingTimeslotProposalEntity = {
  id: string;
  bookingId: string;
  proposedByUserId: string;
  proposedStartDate: Date;
  proposedEndDate: Date;
  previousStartDate: Date | null;
  previousEndDate: Date | null;
  status: BookingProposalStatusValue;
  createdAt: Date;
};

export type BookingToolRefEntity = {
  id: string;
  ownerId: string;
  name: string;
  imageUrl?: string | null;
  owner?: UserRefEntity | null;
};

export type BookingWorkshopRefEntity = {
  id: string;
  name: string;
  managerId: string;
  manager?: UserRefEntity | null;
};

export type BookingTimeslotRefEntity = {
  id: string;
  workshopId: string;
  startTime: Date;
  endTime: Date;
  workshop?: BookingWorkshopRefEntity | null;
};

export type BookingSelectedToolEntity = {
  workshopToolId: string;
  workshopTool: {
    id: string;
    name: string;
    category: string;
  };
};

export type BookingEntity = {
  id: string;
  userId: string;
  toolId?: string | null;
  timeslotId?: string | null;
  workshopId?: string | null;
  startDate: Date;
  endDate: Date;
  pickupTime?: Date | null;
  createdAt?: Date;
  status: BookingStatusValue;
  user?: UserRefEntity | null;
  tool?: BookingToolRefEntity | null;
  workshop?: BookingWorkshopRefEntity | null;
  timeslot?: BookingTimeslotRefEntity | null;
  selectedTools?: BookingSelectedToolEntity[];
  pickupProposals?: BookingPickupProposalEntity[];
  timeslotProposals?: BookingTimeslotProposalEntity[];
};
