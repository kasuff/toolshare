import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { suspensionService } from "./suspension.service";
import { usersService } from "./users.service";

export const usersController = {
  adminMetrics: asyncHandler(async (_req: Request, res: Response) => {
    const result = await usersService.getAdminMetrics();
    res.status(200).json(result);
  }),

  listSuspensionRequests: asyncHandler(async (_req: Request, res: Response) => {
    const requests = await suspensionService.listPending();
    res.status(200).json(requests);
  }),

  decideSuspensionRequest: asyncHandler(async (req: Request, res: Response) => {
    const request = await suspensionService.decide({
      requestId: req.params.requestId,
      adminId: req.authUser!.userId,
      approve: req.body.approve as boolean,
      decisionNote: req.body.decisionNote
    });
    res.status(200).json(request);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const users = await usersService.listUsers({
      role: req.query.role as "USER" | "MODERATOR" | "MANAGER" | undefined,
      search: req.query.search as string | undefined
    });
    res.status(200).json(users);
  }),

  getMine: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.getMyProfile(req.authUser!.userId);
    res.status(200).json(user);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.getById(req.params.id);
    res.status(200).json(user);
  }),

  updateMine: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.updateMyProfile({
      userId: req.authUser!.userId,
      name: req.body.name,
      address: req.body.address,
      expoPushToken: req.body.expoPushToken
    });
    res.status(200).json(user);
  }),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.updateRole({
      targetUserId: req.params.id,
      role: req.body.role as "USER" | "MODERATOR" | "MANAGER",
      actorId: req.authUser!.userId
    });
    res.status(200).json(user);
  }),

  updateSuspension: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.updateSuspension({
      targetUserId: req.params.id,
      isSuspended: req.body.isSuspended as boolean
    });
    res.status(200).json(user);
  })
};
