import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { systemRulesService } from "../services/system-rules.service";
import {
  toSystemSettingResponse,
  toSystemSettingResponseList
} from "./system-rules.presenter";

export const systemRulesController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const settings = await systemRulesService.listSettings();
    res.status(200).json(toSystemSettingResponseList(settings));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const setting = await systemRulesService.updateSetting(
      req.params.key,
      req.body.value as number
    );
    res.status(200).json(toSystemSettingResponse(setting));
  })
};