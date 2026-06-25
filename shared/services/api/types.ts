import type { z } from "zod";
import { userResponseSchema } from "../../contracts/response/users.schema";
import type { AdminMetricsResponse } from "../../contracts/response/users.schema";
import { toolResponseSchema } from "../../contracts/response/tools.schema";
import {
  workshopResponseSchema,
  workshopToolResponseSchema,
  workshopTimeslotResponseSchema
} from "../../contracts/response/workshops.schema";
import {
  bookingResponseSchema,
  bookingPickupProposalResponseSchema,
  bookingTimeslotProposalResponseSchema,
  bookingProposalStatusSchema
} from "../../contracts/response/bookings.schema";
import type { AuthResponse, RefreshResponse } from "../../contracts/response/auth.schema";
import type { RatingResponse } from "../../contracts/response/ratings.schema";
import type { ModerationReportResponse, SuspensionRequestResponse } from "../../contracts/response/moderation.schema";
import { suspensionRequestResponseSchema } from "../../contracts/response/moderation.schema";
import type { SystemSettingResponse } from "../../contracts/response/system-rules.schema";
import type { AddressSuggestionResponse } from "../../contracts/response/address.schema";

export type BackendRole = "USER" | "MODERATOR" | "MANAGER";
export type BackendToolStatus = "AVAILABLE" | "REQUESTED" | "BORROWED";
export type BackendBookingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";

// Single source of truth (ADR-013): Alle Wire-Typen werden direkt aus den Zod-Response-Schemas
// abgeleitet. Nie manuell synchronisieren — Schema ändern, Typ folgt automatisch.
export type BackendUser = z.infer<typeof userResponseSchema>;
export type BackendTool = z.infer<typeof toolResponseSchema>;
export type BackendWorkshop = z.infer<typeof workshopResponseSchema>;
export type BackendWorkshopTool = z.infer<typeof workshopToolResponseSchema>;
export type BackendWorkshopTimeslot = z.infer<typeof workshopTimeslotResponseSchema>;
export type BackendPickupProposalStatus = z.infer<typeof bookingProposalStatusSchema>;
export type BackendPickupProposal = z.infer<typeof bookingPickupProposalResponseSchema>;
export type BackendTimeslotProposal = z.infer<typeof bookingTimeslotProposalResponseSchema>;
export type BackendBooking = z.infer<typeof bookingResponseSchema>;
export type SuspensionRequestItem = SuspensionRequestResponse;

export { suspensionRequestResponseSchema };

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
