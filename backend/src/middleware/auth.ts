import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { authRepository } from "../modules/auth/auth.repository";
import { AppError } from "../utils/app-error";

export type AuthUser = {
  userId: string;
  role: "USER" | "MODERATOR" | "MANAGER";
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError("UNAUTHORIZED", "Missing bearer token", 401);
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid or expired token", 401);
    }

    if (typeof payload.userId !== "string" || typeof payload.role !== "string") {
      throw new AppError("UNAUTHORIZED", "Malformed token payload", 401);
    }

    const user = await authRepository.findById(payload.userId);
    if (!user) {
      throw new AppError("UNAUTHORIZED", "User not found", 401);
    }

    if (user.isSuspended) {
      throw new AppError("ACCOUNT_SUSPENDED", "Konto ist gesperrt.", 403);
    }

    req.authUser = {
      userId: payload.userId,
      role: user.role
    };

    next();
  } catch (error) {
    next(error);
  }
};
