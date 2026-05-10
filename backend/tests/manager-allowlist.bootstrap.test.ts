import { bootstrapManagerAllowlist } from "../src/modules/users/manager-allowlist.bootstrap";
import { prisma } from "../src/config/prisma";
import { env } from "../src/config/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock("../src/config/env", () => ({
  env: {
    managerEmailAllowlist: [] as string[]
  }
}));

const mockedEnv = env as typeof env & { managerEmailAllowlist: string[] };
const findManyMock = vi.mocked(prisma.user.findMany);
const updateManyMock = vi.mocked(prisma.user.updateMany);

describe("bootstrapManagerAllowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnv.managerEmailAllowlist = [];
  });

  it("returns early when allowlist is empty", async () => {
    await bootstrapManagerAllowlist();

    expect(findManyMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("promotes allowlisted users to MANAGER and warns for missing emails", async () => {
    mockedEnv.managerEmailAllowlist = ["admin1@example.com", "admin2@example.com"];

    findManyMock.mockResolvedValueOnce([
      {
        id: "u1",
        email: "admin1@example.com",
        passwordHash: "hash",
        name: "Admin One",
        address: "Address 1",
        role: "USER",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await bootstrapManagerAllowlist();

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        OR: [
          { email: { equals: "admin1@example.com", mode: "insensitive" } },
          { email: { equals: "admin2@example.com", mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["u1"] } },
      data: { role: "MANAGER" }
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Manager allowlist contains emails that are not registered yet: admin2@example.com"
    );

    warnSpy.mockRestore();
  });

  it("does not update when all allowlisted users are already MANAGER", async () => {
    mockedEnv.managerEmailAllowlist = ["manager@example.com"];

    findManyMock.mockResolvedValueOnce([
      {
        id: "m1",
        email: "manager@example.com",
        passwordHash: "hash",
        name: "Manager One",
        address: "Address 2",
        role: "MANAGER",
        createdAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ]);

    await bootstrapManagerAllowlist();

    expect(updateManyMock).not.toHaveBeenCalled();
  });
});
