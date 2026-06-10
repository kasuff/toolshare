import { AppError } from "../../utils/app-error";
import { systemRulesRepository } from "./system-rules.repository";

export const systemRulesService = {
  listRules() {
    return systemRulesRepository.list();
  },

  createRule(text: string) {
    return systemRulesRepository.create(text);
  },

  async updateRule(id: string, text: string) {
    const existing = await systemRulesRepository.findById(id);
    if (!existing) {
      throw new AppError("RULE_NOT_FOUND", "System rule not found", 404);
    }
    return systemRulesRepository.update(id, text);
  },

  async deleteRule(id: string) {
    const existing = await systemRulesRepository.findById(id);
    if (!existing) {
      throw new AppError("RULE_NOT_FOUND", "System rule not found", 404);
    }
    return systemRulesRepository.remove(id);
  }
};
