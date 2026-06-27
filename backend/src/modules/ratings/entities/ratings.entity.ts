export type RatingStatusValue = "VISIBLE" | "HIDDEN";

export type RatingUserRefEntity = {
  id: string;
  name: string;
  role?: string;
};

export type RatingBookingRefEntity = {
  id?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  toolId?: string | null;
  tool?: { id: string; name: string } | null;
  timeslot?: {
    workshopId?: string;
    workshop?: { id: string; name: string } | null;
  } | null;
};

export type RatingEntity = {
  id: string;
  bookingId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment?: string | null;
  status: RatingStatusValue;
  createdAt: Date;
  fromUser?: RatingUserRefEntity | null;
  toUser?: RatingUserRefEntity | null;
  booking?: RatingBookingRefEntity | null;
};