import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import { AuthUser } from "./auth";

export const requireRole = (...roles: AuthUser["role"][]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;
    if (!role || !roles.includes(role)) {
      throw new AppError("FORBIDDEN", "Insufficient role", 403);
    }
    next();
  };
};
