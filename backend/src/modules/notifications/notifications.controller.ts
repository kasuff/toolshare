import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { notificationsService } from "./notifications.service";

export const notificationsController = {
  listMine: asyncHandler(async (req: Request, res: Response) => {
    const notifications = await notificationsService.listForUser(req.authUser!.userId);
    res.status(200).json(notifications);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markAsRead(req.authUser!.userId, req.params.id);
    res.status(204).send();
  })
};
