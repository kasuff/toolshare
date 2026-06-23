import type { BookingStatus, Tool, User } from "../../../types/domain";
import type { BackendBookingStatus, BackendRole, BackendToolStatus } from "../types";

const roleMap: Record<BackendRole, User["role"]> = {
  USER: "NUTZER",
  MODERATOR: "MODERATOR",
  MANAGER: "ADMIN"
};

const toolStatusMap: Record<BackendToolStatus, Tool["status"]> = {
  AVAILABLE: "VERFUEGBAR",
  REQUESTED: "AUSGELIEHEN",
  BORROWED: "AUSGELIEHEN"
};

const bookingStatusMap: Record<BackendBookingStatus, BookingStatus> = {
  PENDING: "OFFEN",
  ACCEPTED: "BESTAETIGT",
  REJECTED: "ABGELEHNT",
  RETURNED: "ABGESCHLOSSEN"
};

const bookingStatusReverseMap: Record<BookingStatus, BackendBookingStatus> = {
  OFFEN: "PENDING",
  BESTAETIGT: "ACCEPTED",
  ABGELEHNT: "REJECTED",
  ABGESCHLOSSEN: "RETURNED"
};

export { roleMap, toolStatusMap, bookingStatusMap, bookingStatusReverseMap };
