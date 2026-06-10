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
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

const mockedAuthRepository = vi.mocked(authRepository);
const mockedRulesRepository = vi.mocked(systemRulesRepository);

const MANAGER_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const RULE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const makeRule = (overrides: Partial<{ id: string; text: string }> = {}) => ({
  id: RULE_ID,
  text: "Werkzeuge sorgfältig behandeln.",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Given: ich bin Admin – Akzeptanzkriterium 1 & 2
// When: ich eine Systemregel ändere und speichere / Auswertungsbereich öffne
// Then: neue Regel angewendet / Kennzahlen sichtbar

// Given: ich bin nicht Admin – Akzeptanzkriterium 3
// When: ich Systemregeln oder Auswertungen öffnen möchte
// Then: Zugriff verweigert

describe.skip("System rules acceptance tests", () => {
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
    it("When: ich Systemregeln abrufe, Then: erhalte ich die Liste (200)", async () => {
      mockedRulesRepository.list.mockResolvedValueOnce([makeRule()]);

      const response = await request(app)
        .get("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ id: RULE_ID, text: "Werkzeuge sorgfältig behandeln." });
    });

    it("When: ich eine Systemregel erstelle, Then: wird sie gespeichert (201)", async () => {
      const newRule = makeRule({ text: "Neue Regel" });
      mockedRulesRepository.create.mockResolvedValueOnce(newRule);

      const response = await request(app)
        .post("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`)
        .send({ text: "Neue Regel" });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ text: "Neue Regel" });
      expect(mockedRulesRepository.create).toHaveBeenCalledWith("Neue Regel");
    });

    it("When: ich eine Systemregel ändere und speichere, Then: wird die neue Regel angewendet (200)", async () => {
      const existing = makeRule();
      const updated = makeRule({ text: "Geänderte Regel" });
      mockedRulesRepository.findById.mockResolvedValueOnce(existing);
      mockedRulesRepository.update.mockResolvedValueOnce(updated);

      const response = await request(app)
        .patch(`/api/system-rules/${RULE_ID}`)
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`)
        .send({ text: "Geänderte Regel" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: RULE_ID, text: "Geänderte Regel" });
      expect(mockedRulesRepository.update).toHaveBeenCalledWith(RULE_ID, "Geänderte Regel");
    });

    it("When: ich eine Systemregel lösche, Then: wird sie entfernt (204)", async () => {
      const existing = makeRule();
      mockedRulesRepository.findById.mockResolvedValueOnce(existing);
      mockedRulesRepository.remove.mockResolvedValueOnce(existing);

      const response = await request(app)
        .delete(`/api/system-rules/${RULE_ID}`)
        .set("Authorization", `Bearer ${makeToken(MANAGER_ID, "MANAGER")}`);

      expect(response.status).toBe(204);
      expect(mockedRulesRepository.remove).toHaveBeenCalledWith(RULE_ID);
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

    it("When: ich Systemregeln abrufen möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .get("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(USER_ID, "USER")}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: { code: "FORBIDDEN" } });
    });

    it("When: ich eine Systemregel erstellen möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .post("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(USER_ID, "USER")}`)
        .send({ text: "Hacker-Regel" });

      expect(response.status).toBe(403);
    });

    it("When: ich eine Systemregel ändern möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .patch(`/api/system-rules/${RULE_ID}`)
        .set("Authorization", `Bearer ${makeToken(USER_ID, "USER")}`)
        .send({ text: "Geändert" });

      expect(response.status).toBe(403);
    });

    it("When: unauthentifiziert auf Systemregeln zugegriffen wird, Then: wird der Zugriff verweigert (401)", async () => {
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

    it("When: ich Systemregeln abrufen möchte, Then: wird der Zugriff verweigert (403)", async () => {
      const response = await request(app)
        .get("/api/system-rules")
        .set("Authorization", `Bearer ${makeToken(USER_ID, "MODERATOR")}`);

      expect(response.status).toBe(403);
    });
  });
});
