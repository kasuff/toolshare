import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { inboxService } from "../services/inbox.service";

export const inboxController = {
  getReceipts: asyncHandler(async (req: Request, res: Response) => {
    const messageKeys = await inboxService.listReadReceipts(req.authUser!.userId);
    res.status(200).json({ messageKeys });
  }),

  addReceipts: asyncHandler(async (req: Request, res: Response) => {
    const { messageKeys } = req.body as { messageKeys: string[] };
    await inboxService.addReadReceipts(req.authUser!.userId, messageKeys);
    res.status(204).send();
  })
};