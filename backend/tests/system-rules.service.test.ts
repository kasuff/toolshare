import { beforeEach, describe, expect, it, vi } from "vitest";
import { systemRulesService } from "../src/modules/system-rules/system-rules.service";
import { systemRulesRepository } from "../src/modules/system-rules/system-rules.repository";
import { ENFORCED_SETTING_DEFS } from "../src/modules/system-rules/system-settings.config";

vi.mock("../src/modules/system-rules/system-rules.repository", () => ({
  systemRulesRepository: {
    findAllValues: vi.fn(),
    upsert: vi.fn()
  }
}));

const mockedRepo = vi.mocked(systemRulesRepository);

describe("systemRulesService.listSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the enforced settings with default values when nothing is stored", async () => {
    mockedRepo.findAllValues.mockResolvedValueOnce(new Map());

    const result = await systemRulesService.listSettings();

    expect(result).toHaveLength(ENFORCED_SETTING_DEFS.length);
    expect(result.map((s) => s.key)).toEqual(ENFORCED_SETTING_DEFS.map((d) => d.key));
    // enforced/defaultValue sind nun Teil der internen Service-Rückgabe
    expect(result.every((s) => "enforced" in s)).toBe(true);
    for (const setting of result) {
      const def = ENFORCED_SETTING_DEFS.find((d) => d.key === setting.key)!;
      expect(setting.value).toBe(def.defaultValue);
      expect(setting.label).toBe(def.label);
      expect(setting.unit).toBe(def.unit);
    }
  });

  it("overrides defaults with stored values", async () => {
    mockedRepo.findAllValues.mockResolvedValueOnce(new Map([["maxLoanDurationDays", 21]]));

    const result = await systemRulesService.listSettings();

    const loan = result.find((s) => s.key === "maxLoanDurationDays");
    expect(loan?.value).toBe(21);
  });
});

describe("systemRulesService.updateSetting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws SETTING_NOT_FOUND for an unknown key", async () => {
    await expect(systemRulesService.updateSetting("unknownKey", 5)).rejects.toMatchObject({
      code: "SETTING_NOT_FOUND",
      status: 404
    });
    expect(mockedRepo.upsert).not.toHaveBeenCalled();
  });

  it("throws SETTING_NOT_FOUND for a known but non-enforced key", async () => {
    await expect(systemRulesService.updateSetting("maxSearchRadiusKm", 10)).rejects.toMatchObject({
      code: "SETTING_NOT_FOUND",
      status: 404
    });
    expect(mockedRepo.upsert).not.toHaveBeenCalled();
  });

  it("throws SETTING_OUT_OF_RANGE when value exceeds the allowed range", async () => {
    await expect(systemRulesService.updateSetting("maxLoanDurationDays", 10_000)).rejects.toMatchObject({
      code: "SETTING_OUT_OF_RANGE",
      status: 400
    });
    expect(mockedRepo.upsert).not.toHaveBeenCalled();
  });

  it("throws SETTING_OUT_OF_RANGE for non-integer values", async () => {
    await expect(systemRulesService.updateSetting("maxLoanDurationDays", 3.5)).rejects.toMatchObject({
      code: "SETTING_OUT_OF_RANGE",
      status: 400
    });
    expect(mockedRepo.upsert).not.toHaveBeenCalled();
  });

  it("upserts and returns the resolved setting when valid", async () => {
    mockedRepo.upsert.mockResolvedValueOnce({
      key: "maxLoanDurationDays",
      value: 30,
      updatedAt: new Date()
    });

    const result = await systemRulesService.updateSetting("maxLoanDurationDays", 30);

    expect(mockedRepo.upsert).toHaveBeenCalledWith("maxLoanDurationDays", 30);
    expect(result).toMatchObject({
      key: "maxLoanDurationDays",
      value: 30,
      label: "Maximale Ausleihdauer eines Werkzeugs",
      unit: "Tage",
      enforced: true,
      defaultValue: 14
    });
  });
});
