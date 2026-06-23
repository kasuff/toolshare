import type { ModerationReport, SuspensionRequestItem } from "./types";
import { request } from "./client";

export const moderationApi = {
  async listReports(token: string) {
    return request<ModerationReport[]>("/moderation/reports", undefined, token);
  },

  async listClosedReports(token: string) {
    return request<ModerationReport[]>("/moderation/reports/closed", undefined, token);
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
    return request(
      "/moderation/reports",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      token
    );
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
    await request(
      `/moderation/reports/${reportId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );
  },

  async listSuspensionRequests(token: string) {
    return request<SuspensionRequestItem[]>("/users/admin/suspension-requests", undefined, token);
  },

  async decideSuspensionRequest(
    requestId: string,
    input: { approve: boolean; decisionNote?: string },
    token: string
  ) {
    return request<SuspensionRequestItem>(
      `/users/admin/suspension-requests/${requestId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );
  },

};
