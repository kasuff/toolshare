import { describe, expect, it } from "vitest";
import {
  adminMetricsResponseSchema,
  userResponseSchema
} from "@toolshare/shared/contracts/response/users.schema";
import {
  authResponseSchema,
  refreshResponseSchema
} from "@toolshare/shared/contracts/response/auth.schema";
import {
  toAdminMetricsResponse,
  toUserResponse
} from "../../src/modules/users/users.presenter";
import { toAuthResponse, toRefreshResponse } from "../../src/modules/auth/auth.presenter";
import type { UserEntity } from "../../src/modules/users/users.entity";

const sampleUser: UserEntity = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "lea@example.com",
  name: "Lea",
  address: "Hauptstr. 1, 80331 München",
  role: "USER",
  isSuspended: false,
  expoPushToken: null,
  createdAt: new Date("2026-06-20T08:00:00.000Z")
};

describe("users + auth contracts", () => {
  it("user presenter output matches userResponseSchema", () => {
    const response = toUserResponse(sampleUser);
    expect(() => userResponseSchema.parse(response)).not.toThrow();
  });

  it("user presenter never leaks the password hash", () => {
    const response = toUserResponse({ ...sampleUser } as UserEntity);
    expect(JSON.stringify(response)).not.toContain("passwordHash");
    expect(response).not.toHaveProperty("passwordHash");
  });

  it("admin metrics presenter output matches schema", () => {
    const response = toAdminMetricsResponse({
      users: 10,
      tools: 5,
      workshops: 2,
      openBookings: 3,
      openReports: 1,
      openSuspensionRequests: 0
    });
    expect(() => adminMetricsResponseSchema.parse(response)).not.toThrow();
  });

  it("auth presenter output matches authResponseSchema with completed user fields", () => {
    const response = toAuthResponse({
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "lea@example.com",
        name: "Lea",
        role: "USER",
        address: "Hauptstr. 1",
        isSuspended: false
      },
      accessToken: "access",
      refreshToken: "refresh"
    });
    expect(() => authResponseSchema.parse(response)).not.toThrow();
    expect(response.user.address).toBe("Hauptstr. 1");
    expect(response.user.isSuspended).toBe(false);
    expect(JSON.stringify(response.user)).not.toContain("passwordHash");
  });

  it("refresh presenter output matches refreshResponseSchema", () => {
    const response = toRefreshResponse({ accessToken: "a", refreshToken: "r" });
    expect(() => refreshResponseSchema.parse(response)).not.toThrow();
  });
});
