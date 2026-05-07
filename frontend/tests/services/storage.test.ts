import { describe, expect, it } from "vitest";
import { loadDb, resetDb, saveDb, uid } from "../../src/services/storage";

describe("storage helpers", () => {
  it("initializes and persists the local database", () => {
    const initialDb = loadDb();
    expect(initialDb.users).not.toHaveLength(0);

    const modifiedDb = {
      ...initialDb,
      users: initialDb.users.slice(0, 1),
    };

    saveDb(modifiedDb);
    expect(loadDb().users).toHaveLength(1);

    resetDb();
    expect(loadDb().users.length).toBeGreaterThan(1);
  });

  it("creates prefixed ids", () => {
    expect(uid("t")).toMatch(/^t_[a-z0-9]{8}$/);
  });
});
