import { beforeEach, describe, expect, it, vi } from "vitest";
import { moderationRepository } from "../src/modules/moderation/moderation.repository";
import { moderationService } from "../src/modules/moderation/moderation.service";
import { suspensionRepository } from "../src/modules/users/suspension.repository";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";
import { notificationsService } from "../src/modules/notifications/notifications.service";
import { addressService } from "../src/modules/address/address.service";

vi.mock("../src/modules/moderation/moderation.repository", () => ({
  moderationRepository: {
    createReport: vi.fn(),
    listOpenReports: vi.fn(),
    listClosedReports: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    findToolsByIds: vi.fn(),
    findWorkshopsByIds: vi.fn(),
    findUsersByIds: vi.fn()
  }
}));

vi.mock("../src/modules/users/suspension.repository", () => ({
  suspensionRepository: {
    create: vi.fn(),
    listManagerIds: vi.fn()
  }
}));

vi.mock("../src/modules/notifications/notifications.repository", () => ({
  notificationsRepository: {
    listByUser: vi.fn(),
    markAsRead: vi.fn(),
    create: vi.fn()
  }
}));

const mockedModerationRepository = vi.mocked(moderationRepository);
const mockedNotificationsRepository = vi.mocked(notificationsRepository);
const mockedSuspensionRepository = vi.mocked(suspensionRepository);

describe("moderationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates and lists reports with enriched target metadata", async () => {
    mockedModerationRepository.createReport.mockResolvedValueOnce({ id: "r1" } as any);
    mockedModerationRepository.listOpenReports.mockResolvedValueOnce([
      {
        id: "r1",
        reporterId: "u1",
        targetType: "TOOL",
        targetId: "tool-1",
        reason: "Spam",
        status: "OPEN",
        createdAt: new Date(),
        reporter: { id: "u1", name: "Lea", email: "lea@test.local" }
      }
    ] as any);
    mockedModerationRepository.findToolsByIds.mockResolvedValueOnce([
      { id: "tool-1", name: "Bohrer", ownerId: "u2", owner: { id: "u2", name: "Max" } }
    ] as any);
    mockedModerationRepository.findWorkshopsByIds.mockResolvedValueOnce([]);
    mockedModerationRepository.findUsersByIds.mockResolvedValueOnce([]);

    const created = await moderationService.createReport({
      reporterId: "u1",
      targetType: "TOOL",
      targetId: "tool-1",
      reason: "Spam"
    });
    const listed = await moderationService.listReports();

    expect(created).toMatchObject({ id: "r1" });
    expect(listed[0]).toMatchObject({
      id: "r1",
      targetLabel: "Bohrer",
      targetHref: "/tools/tool-1",
      subjectUserId: "u2"
    });
  });

  it("rejects unknown report updates", async () => {
    mockedModerationRepository.findById.mockResolvedValueOnce(null);

    await expect(
      moderationService.updateReportStatus({
        reportId: "missing",
        status: "RESOLVED",
        moderatorId: "mod-1"
      })
    ).rejects.toMatchObject({ code: "REPORT_NOT_FOUND", status: 404 });
  });

  it("updates existing report status", async () => {
    mockedModerationRepository.findById.mockResolvedValueOnce({ id: "r1" } as any);
    mockedModerationRepository.updateStatus.mockResolvedValueOnce({ id: "r1", status: "RESOLVED" } as any);

    const result = await moderationService.updateReportStatus({
      reportId: "r1",
      status: "RESOLVED",
      moderatorId: "mod-1",
      decisionNote: "Keine weiteren Massnahmen noetig"
    });

    expect(mockedModerationRepository.updateStatus).toHaveBeenCalledWith(
      "r1",
      "RESOLVED",
      "mod-1",
      "Keine weiteren Massnahmen noetig"
    );
    expect(result).toMatchObject({ id: "r1", status: "RESOLVED" });
  });

  it("sends warning notification when moderation warns user", async () => {
    mockedModerationRepository.findById.mockResolvedValueOnce({ id: "r1" } as any);
    mockedModerationRepository.updateStatus.mockResolvedValueOnce({ id: "r1", status: "RESOLVED" } as any);
    mockedNotificationsRepository.create.mockResolvedValueOnce({ id: "n1" } as any);

    await moderationService.updateReportStatus({
      reportId: "r1",
      status: "RESOLVED",
      moderatorId: "mod-1",
      warnUserId: "user-2",
      warningReason: "Unangemessene Sprache"
    });

    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith(
      "user-2",
      expect.stringContaining("Unangemessene Sprache")
    );
  });
});

describe("notificationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists notifications for a user", async () => {
    mockedNotificationsRepository.listByUser.mockResolvedValueOnce([{ id: "n1" }] as any);

    const result = await notificationsService.listForUser("u1");

    expect(result).toEqual([{ id: "n1" }]);
  });

  it("marks notification as read and rejects unknown ids", async () => {
    mockedNotificationsRepository.markAsRead.mockResolvedValueOnce({ count: 0 } as any);
    await expect(notificationsService.markAsRead("u1", "missing")).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
      status: 404
    });

    mockedNotificationsRepository.markAsRead.mockResolvedValueOnce({ count: 1 } as any);
    await expect(notificationsService.markAsRead("u1", "n1")).resolves.toBeUndefined();
  });
});

describe("addressService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("suggests and validates addresses from nominatim", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          display_name: "Musterstrasse 1, 80331 Muenchen, Deutschland",
          address: {
            road: "Musterstrasse",
            house_number: "1",
            postcode: "80331",
            city: "Muenchen",
            country: "Deutschland"
          }
        }
      ]
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          display_name: "Musterstrasse 1, 80331 Muenchen, Deutschland",
          address: {
            road: "Musterstrasse",
            house_number: "1",
            postcode: "80331",
            city: "Muenchen",
            country: "Deutschland"
          }
        }
      ]
    });

    const suggestions = await addressService.suggest("Musterstrasse 1");
    const validation = await addressService.validate("Musterstrasse 1");

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      street: "Musterstrasse",
      houseNumber: "1",
      postalCode: "80331",
      city: "Muenchen"
    });
    expect(validation).toMatchObject({
      isValid: true,
      normalizedAddress: expect.stringContaining("Musterstrasse 1")
    });
  });

  it("returns invalid validation for empty result and throws on http errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });
    const validation = await addressService.validate("Unknown");
    expect(validation).toMatchObject({
      isValid: false,
      normalizedAddress: null,
      normalizedParts: null
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500
    });
    await expect(addressService.suggest("Server Error")).rejects.toThrow(/status 500/);
  });
});
