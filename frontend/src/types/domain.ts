export type Role = "NUTZER" | "MODERATOR" | "ADMIN";
export type ToolStatus = "VERFUEGBAR" | "AUSGELIEHEN";
export type BookingStatus = "OFFEN" | "BESTAETIGT" | "ABGELEHNT" | "ABGESCHLOSSEN";
export type BookingType = "TOOL" | "WORKSHOP";

export type PickupProposalStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface PickupProposal {
  id: string;
  proposedById: string;
  proposedPickupIso: string;
  previousPickupIso?: string;
  status: PickupProposalStatus;
  createdIso: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  address?: string;
  role: Role;
  isSuspended: boolean;
}

export interface Tool {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  pickupLocation?: string;
  pickupLocationNote?: string;
  status: ToolStatus;
}

export interface WorkshopSlot {
  id: string;
  workshopId: string;
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
}

export interface WorkshopToolItem {
  id: string;
  category: string;
  name: string;
}

export interface Workshop {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  location: string;
  maxCapacity: number;
  extras: string[];
  equipmentItems: WorkshopToolItem[];
  imageUrls: string[];
  toolIds: string[];
}

export interface Booking {
  id: string;
  type: BookingType;
  requesterId: string;
  providerId: string;
  toolId?: string;
  workshopId?: string;
  slotId?: string;
  startIso?: string;
  endIso?: string;
  pickupTimeIso?: string;
  altPickupTimeIso?: string;
  status: BookingStatus;
  createdIso: string;
  /** Display name of the person who requested the booking */
  requesterName?: string;
  /** Display name of the provider (tool owner or workshop manager) */
  providerName?: string;
  /** Tool title or workshop name for listings */
  toolName?: string;
  /** Tool listing image when available */
  toolImageUrl?: string;
  pickupProposals?: PickupProposal[];
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdIso: string;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: "TOOL" | "WORKSHOP" | "USER" | "RATING";
  targetId: string;
  reason: string;
  status: "OFFEN" | "BEARBEITET";
  decisionNote?: string;
  createdIso: string;
}

export interface Rating {
  id: string;
  bookingId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment: string;
  status: "SICHTBAR" | "MODERIERT";
}

export interface SystemRule {
  id: string;
  text: string;
}

export interface AppDb {
  users: User[];
  tools: Tool[];
  workshops: Workshop[];
  slots: WorkshopSlot[];
  bookings: Booking[];
  notifications: Notification[];
  reports: Report[];
  ratings: Rating[];
  rules: SystemRule[];
}
