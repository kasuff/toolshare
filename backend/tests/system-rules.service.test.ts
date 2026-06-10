import { beforeEach, describe, expect, it, vi } from "vitest";
import { systemRulesService } from "../src/modules/system-rules/system-rules.service";
import { systemRulesRepository } from "../src/modules/system-rules/system-rules.repository";

vi.mock("../src/modules/system-rules/system-rules.repository", () => ({
  systemRulesRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

const mockedRepo = vi.mocked(systemRulesRepository);

const RULE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const makeRule = (overrides: Partial<{ id: string; text: string }> = {}) => ({
  id: RULE_ID,
  text: "Keine Beschädigung der Werkzeuge.",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

describe("systemRulesService.listRules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all rules from the repository", async () => {
    const rules = [makeRule()];
    mockedRepo.list.mockResolvedValueOnce(rules);

    const result = await systemRulesService.listRules();

    expect(result).toEqual(rules);
    expect(mockedRepo.list).toHaveBeenCalledTimes(1);
  });
});

describe("systemRulesService.createRule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a rule and returns it", async () => {
    const rule = makeRule({ text: "Neue Regel" });
    mockedRepo.create.mockResolvedValueOnce(rule);

    const result = await systemRulesService.createRule("Neue Regel");

    expect(result).toEqual(rule);
    expect(mockedRepo.create).toHaveBeenCalledWith("Neue Regel");
  });
});

describe("systemRulesService.updateRule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws RULE_NOT_FOUND when the rule does not exist", async () => {
    mockedRepo.findById.mockResolvedValueOnce(null);

    await expect(systemRulesService.updateRule(RULE_ID, "Geändert")).rejects.toMatchObject({
      code: "RULE_NOT_FOUND",
      status: 404
    });

    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it("updates and returns the rule when it exists", async () => {
    const existing = makeRule();
    const updated = makeRule({ text: "Geändert" });
    mockedRepo.findById.mockResolvedValueOnce(existing);
    mockedRepo.update.mockResolvedValueOnce(updated);

    const result = await systemRulesService.updateRule(RULE_ID, "Geändert");

    expect(result).toEqual(updated);
    expect(mockedRepo.update).toHaveBeenCalledWith(RULE_ID, "Geändert");
  });
});

describe("systemRulesService.deleteRule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws RULE_NOT_FOUND when the rule does not exist", async () => {
    mockedRepo.findById.mockResolvedValueOnce(null);

    await expect(systemRulesService.deleteRule(RULE_ID)).rejects.toMatchObject({
      code: "RULE_NOT_FOUND",
      status: 404
    });

    expect(mockedRepo.remove).not.toHaveBeenCalled();
  });

  it("deletes the rule when it exists", async () => {
    const existing = makeRule();
    mockedRepo.findById.mockResolvedValueOnce(existing);
    mockedRepo.remove.mockResolvedValueOnce(existing);

    await systemRulesService.deleteRule(RULE_ID);

    expect(mockedRepo.remove).toHaveBeenCalledWith(RULE_ID);
  });
});
