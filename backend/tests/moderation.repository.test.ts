import { beforeEach, describe, expect, it, vi } from "vitest";
import { moderationRepository } from "../src/modules/moderation/repositories/moderation.repository";

const mocks = vi.hoisted(() => ({
  reportCreate: vi.fn(),
  reportFindMany: vi.fn(),
  reportFindUnique: vi.fn(),
  reportUpdate: vi.fn()
}));

const openReportsQuery = {
  where: { status: { in: ["OPEN", "IN_REVIEW"] } },
  orderBy: { createdAt: "desc" },
  include: {
    reporter: { select: { id: true, name: true, email: true } }
  }
};

const closedReportsQuery = {
  where: { status: { in: ["RESOLVED", "REJECTED"] } },
  orderBy: { decisionAt: "desc" },
  include: {
    reporter: { select: { id: true, name: true, email: true } }
  }
};

vi.mock("../src/config/prisma", () => ({
  prisma: {
    report: {
      create: mocks.reportCreate,
      findMany: mocks.reportFindMany,
      findUnique: mocks.reportFindUnique,
      update: mocks.reportUpdate
    }
  }
}));

describe("moderationRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates reports with generic target reference", async () => {
    mocks.reportCreate.mockResolvedValueOnce({ id: "r1", reason: "Spam" });

    const result = await moderationRepository.createReport({
      reporterId: "user-1",
      targetType: "USER",
      targetId: "22222222-2222-2222-2222-222222222222",
      bookingId: "booking-1",
      reason: "Spam",
      details: "Details",
      conversationContext: "chat context"
    });

    expect(mocks.reportCreate).toHaveBeenCalledWith({
      data: {
        reporterId: "user-1",
        targetType: "USER",
        targetId: "22222222-2222-2222-2222-222222222222",
        bookingId: "booking-1",
        reason: "Spam",
        details: "Details",
        conversationContext: "chat context"
      }
    });
    expect(result).toEqual({ id: "r1", reason: "Spam" });
  });

  it("lists open and in-review reports by newest first", async () => {
    mocks.reportFindMany.mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]);

    const result = await moderationRepository.listOpenReports();

    expect(mocks.reportFindMany).toHaveBeenCalledWith(openReportsQuery);
    expect(result).toEqual([{ id: "r1" }, { id: "r2" }]);
  });

  it("lists closed reports by decision date", async () => {
    mocks.reportFindMany.mockResolvedValueOnce([{ id: "r9", status: "REJECTED" }]);

    const result = await moderationRepository.listClosedReports();

    expect(mocks.reportFindMany).toHaveBeenCalledWith(closedReportsQuery);
    expect(result).toEqual([{ id: "r9", status: "REJECTED" }]);
  });

  it("finds reports by id", async () => {
    mocks.reportFindUnique.mockResolvedValueOnce({ id: "r1" });

    const result = await moderationRepository.findById("r1");

    expect(mocks.reportFindUnique).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(result).toEqual({ id: "r1" });
  });

  it("updates report status and moderator assignment", async () => {
    mocks.reportUpdate.mockResolvedValueOnce({ id: "r1", status: "RESOLVED", moderatorId: "mod-1" });

    const result = await moderationRepository.updateStatus("r1", "RESOLVED", "mod-1", "Entscheidung");

    expect(mocks.reportUpdate).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        status: "RESOLVED",
        moderatorId: "mod-1",
        decisionNote: "Entscheidung",
        decisionAt: expect.any(Date)
      }
    });
    expect(result).toEqual({ id: "r1", status: "RESOLVED", moderatorId: "mod-1" });
  });
});