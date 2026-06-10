import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { systemRulesService } from "./system-rules.service";

export const systemRulesController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const rules = await systemRulesService.listRules();
    res.status(200).json(rules);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const rule = await systemRulesService.createRule(req.body.text as string);
    res.status(201).json(rule);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const rule = await systemRulesService.updateRule(req.params.id, req.body.text as string);
    res.status(200).json(rule);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await systemRulesService.deleteRule(req.params.id);
    res.status(204).send();
  })
};
