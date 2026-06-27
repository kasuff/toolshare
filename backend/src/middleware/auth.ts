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

// Verifiziert ein Access-Token und liefert den AuthUser. Wirft AppError bei
// ungültigem/abgelaufenem Token, unbekanntem oder gesperrtem Nutzer. Wird sowohl
// von requireAuth (Header-Token) als auch vom SSE-Stream (Query-Token, da
// EventSource keine Header setzen kann) genutzt.
export const authenticateToken = async (token: string): Promise<AuthUser> => {
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

  return { userId: payload.userId, role: user.role };
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    // Cookie hat Vorrang (Web-Clients); Bearer-Header dient als Fallback für Mobile.
    const cookieToken = req.cookies?.["at"] as string | undefined;
    const authHeader = req.header("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new AppError("UNAUTHORIZED", "Missing authentication", 401);
    }

    req.authUser = await authenticateToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
