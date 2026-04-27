import { bootstrapManagerAllowlist } from "../src/modules/users/manager-allowlist.bootstrap";
import { prisma } from "../src/config/prisma";
import { env } from "../src/config/env";

jest.mock("../src/config/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    }
  }
}));

jest.mock("../src/config/env", () => ({
  env: {
    managerEmailAllowlist: [] as string[]
  }
}));

const mockedEnv = env as typeof env & { managerEmailAllowlist: string[] };
const findManyMock = prisma.user.findMany as unknown as jest.Mock;
const updateManyMock = prisma.user.updateMany as unknown as jest.Mock;

describe("bootstrapManagerAllowlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        role: "USER"
      }
    ]);

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

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
        role: "MANAGER"
      }
    ]);

    await bootstrapManagerAllowlist();

    expect(updateManyMock).not.toHaveBeenCalled();
  });
});
