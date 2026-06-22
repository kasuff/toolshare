import type {
  Booking,
  BookingSelectedTool,
  BookingStatus,
  PickupProposal,
  PublicRating,
  Rating,
  TimeslotProposal,
  Tool,
  User,
  Workshop,
  WorkshopBookedRange,
  WorkshopSlot
} from "../../types/domain";
export type BackendRole = "USER" | "MODERATOR" | "MANAGER";
export type BackendToolStatus = "AVAILABLE" | "REQUESTED" | "BORROWED";
export type BackendBookingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";
export type BackendUser = {
  id: string;
  email: string;
  name: string;
  address?: string;
  avatarUrl?: string | null;
  role: BackendRole;
  isSuspended: boolean;
};
export type BackendMetrics = {
  users: number;
  tools: number;
  workshops: number;
  openBookings: number;
  openReports: number;
  openSuspensionRequests: number;
};

export type ModerationReport = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: "TOOL" | "WORKSHOP" | "USER" | "RATING";
  targetId: string;
  targetLabel: string;
  targetHref: string | null;
  subjectUserId: string | null;
  subjectUserName: string | null;
  ratingPreview?: {
    score: number;
    comment: string | null;
    fromUserName: string;
    listingLabel: string | null;
  } | null;
  reason: string;
  details?: string;
  conversationContext?: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  decisionNote?: string | null;
  decisionAt?: string | null;
  moderatorId?: string | null;
  moderatorName?: string | null;
  createdAt: string;
};

export type BackendRating = {
  id: string;
  bookingId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment?: string | null;
  status?: "VISIBLE" | "HIDDEN";
  createdAt: string;
  fromUser?: { id: string; name: string } | null;
  booking?: {
    tool?: { id: string; name: string } | null;
    timeslot?: { workshop?: { id: string; name: string } | null } | null;
  } | null;
};

export type SuspensionRequestItem = {
  id: string;
  userId: string;
  requestedById: string;
  reportId: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: { id: string; name: string; email: string; isSuspended: boolean };
  requestedBy: { id: string; name: string };
  report?: { id: string; reason: string; targetType: string; targetId: string } | null;
};

export type SystemSetting = {
  key: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
};

export type AddressSuggestion = {
  label: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

export type AuthPayload = {
  user: {
    id: string;
    email: string;
    name: string;
    address?: string;
    role: BackendRole;
    isSuspended?: boolean;
  };
  accessToken: string;
  refreshToken: string;
};

export type BackendTool = {
  id: string;
  ownerId: string;
  owner?: Pick<BackendUser, "id" | "name"> | null;
  name: string;
  description: string;
  category: string;
  imageUrl?: string | null;
  pickupLocation?: string | null;
  pickupLocationNote?: string | null;
  status: BackendToolStatus;
  bookings?: BackendWorkshopBookedRange[];
};

export type BackendWorkshop = {
  id: string;
  managerId: string;
  manager?: Pick<BackendUser, "id" | "name"> | null;
  name: string;
  description: string;
  location: string;
  maxCapacity: number;
  equipment?: string[];
  extras?: string[];
  imageUrls?: string[];
  workshopTools?: BackendWorkshopTool[];
  timeslots?: BackendWorkshopTimeslot[];
  bookings?: BackendWorkshopBookedRange[];
};

export type BackendWorkshopBookedRange = {
  id: string;
  startDate: string;
  endDate: string;
  status: BackendBookingStatus;
};

export type BackendWorkshopTool = {
  id: string;
  workshopId?: string;
  name: string;
  category: string;
  status?: BackendToolStatus;
};

export type BackendWorkshopTimeslot = {
  id: string;
  workshopId: string;
  startTime: string;
  endTime: string;
  blockedByOwner?: boolean;
};

export type BackendPickupProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export type BackendPickupProposal = {
  id: string;
  bookingId: string;
  proposedByUserId: string;
  proposedPickupTime: string;
  proposedReturnTime: string | null;
  previousPickupTime: string | null;
  previousReturnTime: string | null;
  status: BackendPickupProposalStatus;
  createdAt: string;
};

export type BackendTimeslotProposal = {
  id: string;
  bookingId: string;
  proposedByUserId: string;
  proposedStartDate: string;
  proposedEndDate: string;
  previousStartDate: string | null;
  previousEndDate: string | null;
  status: BackendPickupProposalStatus;
  createdAt: string;
};

export type BackendBooking = {
  id: string;
  userId: string;
  toolId?: string | null;
  timeslotId?: string | null;
  workshopId?: string | null;
  startDate: string;
  endDate: string;
  pickupTime?: string | null;
  createdAt?: string;
  status: BackendBookingStatus;
  user?: BackendUser | null;
  tool?: (BackendTool & { owner?: BackendUser | null }) | null;
  workshop?: {
    id: string;
    name: string;
    managerId: string;
    manager?: BackendUser | null;
  } | null;
  timeslot?: {
    id: string;
    workshopId: string;
    startTime: string;
    endTime: string;
    workshop?: {
      id: string;
      name: string;
      managerId: string;
      manager?: BackendUser | null;
    } | null;
  } | null;
  selectedTools?: Array<{
    workshopToolId: string;
    workshopTool: BackendWorkshopTool;
  }>;
  pickupProposals?: BackendPickupProposal[];
  timeslotProposals?: BackendTimeslotProposal[];
};
