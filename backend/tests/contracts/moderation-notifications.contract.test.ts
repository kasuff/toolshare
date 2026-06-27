import { describe, expect, it } from "vitest";
import { moderationReportResponseSchema } from "@toolshare/shared/contracts/response/moderation.schema";
import { notificationResponseSchema } from "@toolshare/shared/contracts/response/notifications.schema";
import {
  toModerationReportResponse,
  type ModerationLookups,
  type ReportRowInput
} from "../../src/modules/moderation/controllers/moderation.presenter";
import { toNotificationResponse } from "../../src/modules/notifications/controllers/notifications.presenter";
import type { NotificationEntity } from "../../src/modules/notifications/entities/notifications.entity";

const emptyLookups: ModerationLookups = {
  tools: [],
  workshops: [],
  users: [],
  ratings: [],
  moderators: []
};

const toolReport: ReportRowInput = {
  id: "11111111-1111-1111-1111-111111111111",
  reporterId: "22222222-2222-2222-2222-222222222222",
  reporter: { id: "22222222-2222-2222-2222-222222222222", name: "Lea" },
  targetType: "TOOL",
  targetId: "33333333-3333-3333-3333-333333333333",
  reason: "Spam",
  status: "OPEN",
  decisionAt: null,
  moderatorId: null,
  createdAt: new Date("2026-06-20T08:00:00.000Z")
};

describe("moderation + notifications contracts", () => {
  it("moderation presenter enriches a tool report and matches schema", () => {
    const response = toModerationReportResponse(toolReport, {
      ...emptyLookups,
      tools: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          name: "Bohrer",
          ownerId: "44444444-4444-4444-4444-444444444444",
          owner: { id: "44444444-4444-4444-4444-444444444444", name: "Max" }
        }
      ]
    });
    expect(() => moderationReportResponseSchema.parse(response)).not.toThrow();
    expect(response.targetLabel).toBe("Bohrer");
    expect(response.targetHref).toBe("/tools/33333333-3333-3333-3333-333333333333");
    expect(response.subjectUserId).toBe("44444444-4444-4444-4444-444444444444");
    expect(typeof response.createdAt).toBe("string");
  });

  it("moderation presenter serializes decisionAt to an ISO string", () => {
    const response = toModerationReportResponse(
      {
        ...toolReport,
        status: "RESOLVED",
        decisionAt: new Date("2026-06-21T10:00:00.000Z"),
        moderatorId: "55555555-5555-5555-5555-555555555555"
      },
      { ...emptyLookups, moderators: [{ id: "55555555-5555-5555-5555-555555555555", name: "Mod" }] }
    );
    expect(response.decisionAt).toBe("2026-06-21T10:00:00.000Z");
    expect(response.moderatorName).toBe("Mod");
  });

  it("notification presenter output matches notificationResponseSchema", () => {
    const notification: NotificationEntity = {
      id: "66666666-6666-6666-6666-666666666666",
      userId: "22222222-2222-2222-2222-222222222222",
      message: "ERMAHNUNG: Bitte Regeln beachten",
      read: false,
      createdAt: new Date("2026-06-20T08:00:00.000Z")
    };
    const response = toNotificationResponse(notification);
    expect(() => notificationResponseSchema.parse(response)).not.toThrow();
  });
});