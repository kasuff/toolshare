import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import { AuthUser } from "./auth";

const ROLE_RANK: Record<AuthUser["role"], number> = {
  USER: 0,
  MODERATOR: 1,
  MANAGER: 2
};

export const requireRole = (...roles: AuthUser["role"][]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;
    const roleRank = role ? ROLE_RANK[role] : undefined;
    const isAllowed =
      roleRank !== undefined && roles.some((requiredRole) => roleRank >= ROLE_RANK[requiredRole]);
    if (!isAllowed) {
      throw new AppError("FORBIDDEN", "Insufficient role", 403);
    }
    next();
  };
};
