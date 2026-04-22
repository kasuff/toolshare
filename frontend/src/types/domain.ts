export type Role = "NUTZER" | "MODERATOR" | "ADMIN";
export type ToolStatus = "VERFUEGBAR" | "AUSGELIEHEN";
export type BookingStatus = "OFFEN" | "BESTAETIGT" | "ABGELEHNT" | "ABGESCHLOSSEN";
export type BookingType = "TOOL" | "WORKSHOP";

export interface User {
  id: string;
  name: string;
  email: string;
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
  status: ToolStatus;
}

export interface WorkshopSlot {
  id: string;
  workshopId: string;
  startIso: string;
  endIso: string;
  blockedByOwner: boolean;
}

export interface Workshop {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  location: string;
  maxCapacity: number;
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
