import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export type AuthUser = {
  userId: string;
  role: "USER" | "MODERATOR" | "MANAGER";
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
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

  req.authUser = {
    userId: payload.userId,
    role: payload.role as AuthUser["role"]
  };

  next();
};
