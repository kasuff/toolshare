import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { authRepository } from "../src/modules/auth/auth.repository";
import { systemRulesRepository } from "../src/modules/system-rules/system-rules.repository";

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findById: vi.fn()
  }
}));

vi.mock("../src/modules/system-rules/system-rules.repository", () => ({
  systemRulesRepository: {
    findAllValues: vi.fn(),
    upsert: vi.fn()
  }
}));

const mockedAuthRepository = vi.mocked(authRepository);
const mockedRulesRepository = vi.mocked(systemRulesRepository);

const MANAGER_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

// Given: ich bin Admin – Akzeptanzkriterium 1 & 2
// When: ich eine Systemeinstellung ändere und speichere
// Then: neuer Wert wird übernommen

// Given: ich bin nicht Admin – Akzeptanzkriterium 3
// When: ich Systemeinstellungen öffnen/ändern möchte
// Then: Zugriff verweigert

describe("System settings acceptance tests", () => {
  let app: Express;

  const makeToken = (userId: string, role: "MANAGER" | "MODERATOR" | "USER") =>
    jwt.sign({ userId, role }, process.env.JWT_SECRET as string);

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuthRepository.findById.mockResolvedValue({
      id: MANAGER_ID,
      role: "MANAGER",
      isSuspended: false
    } as any);
  });

  describe("Given: ich bin Admin (MANAGER)", () => {
    it("When: ich Systemeinstellungen abrufe, Then: erhalte ich die Liste mit Defaults (200)", async () => {
      mockedRulesRepository.findAllValues.mockResolvedValueOnce(new Map());

      const response = await request(app)
        .get("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toMatchObject({
        key: "maxLoanDurationDays",
        label: "Maximale Ausleihdauer eines Werkzeugs",
        unit: "Tage",
        value: 14
      });
    });

    it("When: ich eine Einstellung ändere und speichere, Then: wird der neue Wert übernommen (200)", async () => {
      mockedRulesRepository.upsert.mockResolvedValueOnce({
        key: "maxLoanDurationDays",
        value: 21,
        updatedAt: new Date()
      } as any);

      const response = await request(app)
        .put("/api/system-rules/maxLoanDurationDays")
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`)
        .send({ value: 21 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ key: "maxLoanDurationDays", value: 21 });
      expect(mockedRulesRepository.upsert).toHaveBeenCalledWith("maxLoanDurationDays", 21);
    });

    it("When: ich einen unbekannten Schlüssel ändere, Then: 400 (Validation)", async () => {
      const response = await request(app)
        .put("/api/system-rules/doesNotExist")
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`)
        .send({ value: 5 });

      expect(response.status).toBe(400);
      expect(mockedRulesRepository.upsert).not.toHaveBeenCalled();
    });

    it("When: ich einen Wert außerhalb des Bereichs setze, Then: 400 (Range)", async () => {
      const response = await request(app)
        .put("/api/system-rules/maxLoanDurationDays")
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`)
        .send({ value: 10000 });

      expect(response.status).toBe(400);
      expect(mockedRulesRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Given: ich bin nicht Admin", () => {
    beforeEach(() => {
      mockedAuthRepository.findById.mockResolvedValue({
        id: USER_ID,
        role: "USER",
        isSuspended: false
      } as any);
    });

    it("When: ich Systemeinstellungen abrufen möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .get("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(USER_ID, "USER")}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: "FORBIDDEN", status: 403 });
    });

    it("When: ich eine Einstellung ändern möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .put("/api/system-rules/maxLoanDurationDays")
        .set("Authorization", `Bearer ${makeToken(USER_ID, "USER")}`)
        .send({ value: 21 });

      expect(response.status).toBe(403);
    });

    it("When: unauthentifiziert zugegriffen wird, Then: wird der Zugriff verweigert (401)", async () => {
      const response = await request(app).get("/api/system-rules");

      expect(response.status).toBe(401);
    });
  });

  describe("Given: ich bin Moderator (nicht Admin)", () => {
    beforeEach(() => {
      mockedAuthRepository.findById.mockResolvedValue({
        id: USER_ID,
        role: "MODERATOR",
        isSuspended: false
      } as any);
    });

    it("When: ich Systemeinstellungen abrufen möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .get("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(USER_ID, "MODERATOR")}`);

      expect(response.status).toBe(403);
    });
  });
});
