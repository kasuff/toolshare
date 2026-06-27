import { beforeEach, describe, expect, it, vi } from "vitest";
import { inboxRepository } from "../src/modules/inbox/repositories/inbox.repository";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    inboxReadReceipt: {
      findMany: mocks.findMany,
      createMany: mocks.createMany
    }
  }
}));

describe("inboxRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the message keys for a user", async () => {
    mocks.findMany.mockResolvedValueOnce([{ messageKey: "req:b1" }, { messageKey: "__seeded__" }]);

    const result = await inboxRepository.listKeys("user-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { messageKey: true }
    });
    expect(result).toEqual(["req:b1", "__seeded__"]);
  });

  it("inserts deduplicated keys with skipDuplicates (idempotent)", async () => {
    mocks.createMany.mockResolvedValueOnce({ count: 2 });

    await inboxRepository.addKeys("user-1", ["req:b1", "req:b1", "prop:b1:p1"]);

    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", messageKey: "req:b1" },
        { userId: "user-1", messageKey: "prop:b1:p1" }
      ],
      skipDuplicates: true
    });
  });

  it("is a no-op when there are no keys", async () => {
    await inboxRepository.addKeys("user-1", []);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});