import { beforeEach, describe, expect, it, vi } from "vitest";
import { moderationRepository } from "../src/modules/moderation/moderation.repository";

const mocks = vi.hoisted(() => ({
  reportCreate: vi.fn(),
  reportFindMany: vi.fn(),
  reportFindUnique: vi.fn(),
  reportUpdate: vi.fn()
}));

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

  it("creates reports with optional booking reference", async () => {
    mocks.reportCreate.mockResolvedValueOnce({ id: "r1", reason: "Spam" });

    const result = await moderationRepository.createReport({
      reporterId: "user-1",
      bookingId: "booking-1",
      reason: "Spam",
      details: "Details"
    });

    expect(mocks.reportCreate).toHaveBeenCalledWith({
      data: {
        reporterId: "user-1",
        bookingId: "booking-1",
        reason: "Spam",
        details: "Details"
      }
    });
    expect(result).toEqual({ id: "r1", reason: "Spam" });
  });

  it("lists open and in-review reports by newest first", async () => {
    mocks.reportFindMany.mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]);

    const result = await moderationRepository.listOpenReports();

    expect(mocks.reportFindMany).toHaveBeenCalledWith({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "r1" }, { id: "r2" }]);
  });

  it("finds reports by id", async () => {
    mocks.reportFindUnique.mockResolvedValueOnce({ id: "r1" });

    const result = await moderationRepository.findById("r1");

    expect(mocks.reportFindUnique).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(result).toEqual({ id: "r1" });
  });

  it("updates report status and moderator assignment", async () => {
    mocks.reportUpdate.mockResolvedValueOnce({ id: "r1", status: "RESOLVED", moderatorId: "mod-1" });

    const result = await moderationRepository.updateStatus("r1", "RESOLVED", "mod-1");

    expect(mocks.reportUpdate).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "RESOLVED", moderatorId: "mod-1" }
    });
    expect(result).toEqual({ id: "r1", status: "RESOLVED", moderatorId: "mod-1" });
  });
});
