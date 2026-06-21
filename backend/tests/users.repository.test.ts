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
    tool: { count: mocks.toolCount },
    workshop: { count: mocks.workshopCount },
    booking: { count: mocks.bookingCount },
    report: { count: mocks.reportCount },
    suspensionRequest: { count: mocks.suspensionRequestCount },
    $transaction: mocks.transaction
  }
}));

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  address: true,
  role: true,
  isSuspended: true,
  createdAt: true,
  expoPushToken: true
};

describe("usersRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds public user profile by id", async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ id: "u1", name: "Lea" });

    const result = await usersRepository.findByIdPublic("u1");

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: publicUserSelect
    });
    expect(result).toEqual({ id: "u1", name: "Lea" });
  });

  it("lists users with role and search filters", async () => {
    mocks.userFindMany.mockResolvedValueOnce([{ id: "u1" }]);

    const result = await usersRepository.listPublic({ role: "USER", search: "lea" });

    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: {
        role: "USER",
        OR: [
          { name: { contains: "lea", mode: "insensitive" } },
          { email: { contains: "lea", mode: "insensitive" } },
          { address: { contains: "lea", mode: "insensitive" } }
        ]
      },
      select: publicUserSelect,
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "u1" }]);
  });

  it("updates profile, role and suspension", async () => {
    mocks.userUpdate.mockResolvedValue({ id: "u1" });

    await usersRepository.updateProfile("u1", { name: "Lea Neu" });
    await usersRepository.updateRole("u1", "MODERATOR");
    await usersRepository.updateSuspension("u1", true);

    expect(mocks.userUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "u1" },
      data: { name: "Lea Neu" },
      select: publicUserSelect
    });
    expect(mocks.userUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "u1" },
      data: { role: "MODERATOR" },
      select: publicUserSelect
    });
    expect(mocks.userUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: "u1" },
      data: { isSuspended: true },
      select: publicUserSelect
    });
  });

  it("aggregates system metrics", async () => {
    mocks.transaction.mockImplementationOnce(async (queries: Promise<unknown>[]) => Promise.all(queries));
    mocks.userCount.mockResolvedValueOnce(10);
    mocks.toolCount.mockResolvedValueOnce(20);
    mocks.workshopCount.mockResolvedValueOnce(3);
    mocks.bookingCount.mockResolvedValueOnce(2);
    mocks.reportCount.mockResolvedValueOnce(1);
    mocks.suspensionRequestCount.mockResolvedValueOnce(4);

    const result = await usersRepository.getSystemMetrics();

    expect(result).toEqual({
      users: 10,
      tools: 20,
      workshops: 3,
      openBookings: 2,
      openReports: 1,
      openSuspensionRequests: 4
    });
  });
});
