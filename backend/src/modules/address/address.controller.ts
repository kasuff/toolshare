import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { addressService } from "./address.service";

export const addressController = {
  suggest: asyncHandler(async (req: Request, res: Response) => {
    const suggestions = await addressService.suggest(req.query.q as string);
    res.status(200).json({ suggestions });
  }),

  validate: asyncHandler(async (req: Request, res: Response) => {
    const result = await addressService.validate(req.query.q as string);
    res.status(200).json(result);
  })
};
