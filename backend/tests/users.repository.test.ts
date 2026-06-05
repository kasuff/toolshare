import { beforeEach, describe, expect, it, vi } from "vitest";
import { usersRepository } from "../src/modules/users/users.repository";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  userUpdate: vi.fn(),
  userCount: vi.fn(),
  toolCount: vi.fn(),
  workshopCount: vi.fn(),
  bookingCount: vi.fn(),
  reportCount: vi.fn(),
  suspensionRequestCount: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      findMany: mocks.userFindMany,
      update: mocks.userUpdate,
      count: mocks.userCount
    },
    tool: {
      count: mocks.toolCount
    },
    workshop: {
      count: mocks.workshopCount
    },
    booking: {
      count: mocks.bookingCount
    },
    report: {
      count: mocks.reportCount
    },
    suspensionRequest: {
      count: mocks.suspensionRequestCount
    },
    $transaction: mocks.transaction
  }
}));

describe("usersRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds user by id with public projection", async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ id: "u1" });

    const result = await usersRepository.findByIdPublic("u1");

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: {
        id: true,
        email: true,
        name: true,
        address: true,
        role: true,
        isSuspended: true,
        createdAt: true
      }
    });
    expect(result).toEqual({ id: "u1" });
  });

  it("lists users with role/search filters", async () => {
    mocks.userFindMany.mockResolvedValueOnce([{ id: "u1" }]);

    const result = await usersRepository.listPublic({
      role: "MODERATOR",
      search: "lea"
    });

    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: {
        role: "MODERATOR",
        OR: [
          { name: { contains: "lea", mode: "insensitive" } },
          { email: { contains: "lea", mode: "insensitive" } },
          { address: { contains: "lea", mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        address: true,
        role: true,
        isSuspended: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "u1" }]);
  });

  it("updates profile, role and suspension with public projection", async () => {
    mocks.userUpdate
      .mockResolvedValueOnce({ id: "u1", name: "Lea Neu" })
      .mockResolvedValueOnce({ id: "u1", role: "MODERATOR" })
      .mockResolvedValueOnce({ id: "u1", isSuspended: true });

    const profile = await usersRepository.updateProfile("u1", { name: "Lea Neu" });
    const role = await usersRepository.updateRole("u1", "MODERATOR");
    const suspension = await usersRepository.updateSuspension("u1", true);

    expect(profile).toEqual({ id: "u1", name: "Lea Neu" });
    expect(role).toEqual({ id: "u1", role: "MODERATOR" });
    expect(suspension).toEqual({ id: "u1", isSuspended: true });
    expect(mocks.userUpdate).toHaveBeenCalledTimes(3);
  });

  it("returns aggregated admin metrics", async () => {
    mocks.transaction.mockImplementationOnce(async (queries: any[]) => {
      await queries[0];
      await queries[1];
      await queries[2];
      await queries[3];
      await queries[5];
      return [10, 20, 5, 3, 2, 1];
    });
    mocks.userCount.mockResolvedValueOnce(10);
    mocks.toolCount.mockResolvedValueOnce(20);
    mocks.workshopCount.mockResolvedValueOnce(5);
    mocks.bookingCount.mockResolvedValueOnce(3);
    mocks.reportCount.mockResolvedValueOnce(2);
    mocks.suspensionRequestCount.mockResolvedValueOnce(1);

    const result = await usersRepository.getSystemMetrics();

    expect(result).toEqual({
      users: 10,
      tools: 20,
      workshops: 5,
      openBookings: 3,
      openReports: 2,
      openSuspensionRequests: 1
    });
  });
});
