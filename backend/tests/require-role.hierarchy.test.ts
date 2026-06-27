import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireRole } from "../src/middleware/require-role";
import { AppError } from "../src/utils/app-error";

type Role = "USER" | "MODERATOR" | "MANAGER";

const makeReq = (role?: Role): Request =>
  ({ authUser: role ? { userId: "u1", role } : undefined } as Request);

const runCheck = (requiredRoles: Role[], role?: Role) => {
  const next = vi.fn<Parameters<NextFunction>, ReturnType<NextFunction>>();
  const handler = requireRole(...requiredRoles);
  const response = {} as Response;
  const request = makeReq(role);

  return { handler, request, response, next };
};

describe("requireRole hierarchy", () => {
  it("allows user access for USER", () => {
    const { handler, request, response, next } = runCheck(["USER"], "USER");

    handler(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("allows moderator access for USER routes", () => {
    const { handler, request, response, next } = runCheck(["USER"], "MODERATOR");

    handler(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("allows manager access for MODERATOR routes", () => {
    const { handler, request, response, next } = runCheck(["MODERATOR"], "MANAGER");

    handler(request, response, next);

    expect(next).toHaveBeenCalled();
  });

  it("blocks moderator access for MANAGER routes", () => {
    const { handler, request, response, next } = runCheck(["MANAGER"], "MODERATOR");

    expect(() => handler(request, response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks when no role is present", () => {
    const { handler, request, response, next } = runCheck(["USER"]);

    expect(() => handler(request, response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });
});