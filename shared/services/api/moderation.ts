import type { ModerationReport, SuspensionRequestItem } from "./types";
import { request, requestParsed } from "./client";
import {
  moderationReportListResponseSchema,
  suspensionRequestResponseSchema,
  suspensionRequestListResponseSchema
} from "../../contracts/response/moderation.schema";

export const moderationApi = {
  async listReports(token: string): Promise<ModerationReport[]> {
    return requestParsed(moderationReportListResponseSchema, "/moderation/reports", undefined, token);
  },

  async listClosedReports(token: string): Promise<ModerationReport[]> {
    return requestParsed(moderationReportListResponseSchema, "/moderation/reports/closed", undefined, token);
  },

  async createReport(
    input: {
      targetType: "TOOL" | "WORKSHOP" | "USER" | "RATING";
      targetId: string;
      reason: string;
      details?: string;
      bookingId?: string;
      conversationContext?: string;
    },
    token: string
  ) {
    return request("/moderation/reports", { method: "POST", body: JSON.stringify(input) }, token);
  },

  async updateReportStatus(
    reportId: string,
    input: {
      status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
      decisionNote?: string;
      warnUserId?: string;
      warningReason?: string;
      requestSuspensionUserId?: string;
      suspensionReason?: string;
      deleteTool?: boolean;
      deleteWorkshop?: boolean;
      deleteRating?: boolean;
    },
    token: string
  ) {
    await request(`/moderation/reports/${reportId}`, { method: "PATCH", body: JSON.stringify(input) }, token);
  },

  async listSuspensionRequests(token: string): Promise<SuspensionRequestItem[]> {
    return requestParsed(suspensionRequestListResponseSchema, "/users/admin/suspension-requests", undefined, token);
  },

  async decideSuspensionRequest(
    requestId: string,
    input: { approve: boolean; decisionNote?: string },
    token: string
  ): Promise<SuspensionRequestItem> {
    return requestParsed(
      suspensionRequestResponseSchema,
      `/users/admin/suspension-requests/${requestId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      token
    );
  }
};
