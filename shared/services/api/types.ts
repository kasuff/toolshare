import type { z } from "zod";
import { userResponseSchema } from "../../contracts/response/users.schema";
import type { AdminMetricsResponse } from "../../contracts/response/users.schema";
import { toolResponseSchema } from "../../contracts/response/tools.schema";
import {
  workshopResponseSchema,
  workshopToolResponseSchema,
  workshopTimeslotResponseSchema
} from "../../contracts/response/workshops.schema";
import type { AuthResponse, RefreshResponse } from "../../contracts/response/auth.schema";
import type { RatingResponse } from "../../contracts/response/ratings.schema";
import type { ModerationReportResponse } from "../../contracts/response/moderation.schema";
import type { SystemSettingResponse } from "../../contracts/response/system-rules.schema";
import type { AddressSuggestionResponse } from "../../contracts/response/address.schema";

export type BackendRole = "USER" | "MODERATOR" | "MANAGER";
export type BackendToolStatus = "AVAILABLE" | "REQUESTED" | "BORROWED";
export type BackendBookingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";

// Single source of truth (ADR-013): Diese Typen werden direkt aus den Zod-Response-Schemas
// abgeleitet. Nie manuell synchronisieren — Schema ändern, Typ folgt automatisch.
export type BackendUser = z.infer<typeof userResponseSchema>;
export type BackendTool = z.infer<typeof toolResponseSchema>;
export type BackendWorkshop = z.infer<typeof workshopResponseSchema>;
export type BackendWorkshopTool = z.infer<typeof workshopToolResponseSchema>;
export type BackendWorkshopTimeslot = z.infer<typeof workshopTimeslotResponseSchema>;

export type BackendMetrics = AdminMetricsResponse;
export type ModerationReport = ModerationReportResponse;
export type BackendRating = RatingResponse;
export type SystemSetting = SystemSettingResponse;
export type AddressSuggestion = AddressSuggestionResponse;
export type AuthPayload = AuthResponse;
export type RefreshPayload = RefreshResponse;

export type BackendWorkshopBookedRange = {
  id: string;
  startDate: string;
  endDate: string;
  status: BackendBookingStatus;
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
