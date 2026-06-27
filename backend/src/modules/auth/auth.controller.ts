import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { userRegistrationsTotal, userLoginsTotal } from "../../utils/metrics";
import { authService } from "./auth.service";

const REFRESH_COOKIE = "rt";
const ACCESS_COOKIE = "at";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api",
  maxAge: 60 * 60 * 1000  // 1h — entspricht JWT_EXPIRES_IN-Default
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_COOKIE, token, accessCookieOptions);
}

function clearAccessCookie(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: "/api" });
}

// Cookie hat Vorrang; Body-Token dient als Fallback für native Mobile-Clients.
function extractRefreshToken(req: Request): string | undefined {
  return (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    userRegistrationsTotal.inc();
    setRefreshCookie(res, result.refreshToken);
    setAccessCookie(res, result.accessToken);
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await authService.login(req.body);
      userLoginsTotal.inc({ status: "success" });
      setRefreshCookie(res, result.refreshToken);
      setAccessCookie(res, result.accessToken);
      res.status(200).json(result);
    } catch (err) {
      userLoginsTotal.inc({ status: "failed" });
      throw err;
    }
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = extractRefreshToken(req);
    if (!refreshToken) {
      res.status(401).json({ error: { message: "No refresh token", code: "UNAUTHORIZED" } });
      return;
    }
    const result = await authService.refresh(refreshToken);
    setRefreshCookie(res, result.refreshToken);
    setAccessCookie(res, result.accessToken);
    res.status(200).json(result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = extractRefreshToken(req);
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearRefreshCookie(res);
    clearAccessCookie(res);
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
