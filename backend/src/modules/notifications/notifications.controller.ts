import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { parsePageParams } from "../../utils/pagination";
import { notificationsService } from "./notifications.service";

export const notificationsController = {
  listMine: asyncHandler(async (req: Request, res: Response) => {
    // Standardmäßig die neuesten 100; per ?limit=&offset= überschreibbar (max 200).
    const page = parsePageParams(req.query, { defaultLimit: 100, maxLimit: 200 });
    const notifications = await notificationsService.listForUser(req.authUser!.userId, page);
    res.status(200).json(notifications);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markAsRead(req.authUser!.userId, req.params.id);
    res.status(204).send();
  })
};
