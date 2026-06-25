import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { userRegistrationsTotal, userLoginsTotal } from "../../utils/metrics";
import { authService } from "./auth.service";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    userRegistrationsTotal.inc();
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await authService.login(req.body);
      userLoginsTotal.inc({ status: "success" });
      res.status(200).json(result);
    } catch (err) {
      userLoginsTotal.inc({ status: "failed" });
      throw err;
    }
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(200).json(result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.body.refreshToken as string);
    res.status(204).send();
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword({
      userId: req.authUser!.userId,
      currentPassword: req.body.currentPassword as string,
      newPassword: req.body.newPassword as string
    });
    res.status(204).send();
  })
};
