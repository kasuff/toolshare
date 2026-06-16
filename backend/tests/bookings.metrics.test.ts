import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";

vi.mock("../src/modules/bookings/bookings.service", () => ({
  bookingsService: {
    listForUserContext: vi.fn(),
    createToolBooking: vi.fn(),
    createWorkshopBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    createPickupProposal: vi.fn(),
    respondPickupProposal: vi.fn()
  }
}));

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    createUser: vi.fn()
  }
}));

vi.mock("../src/utils/metrics", () => ({
  metricsRegistry: {
    contentType: "text/plain",
    metrics: vi.fn().mockResolvedValue("")
  },
  httpRequestsTotal: { inc: vi.fn() },
  httpRequestDurationSeconds: { observe: vi.fn() },
  httpRequestSizeBytes: { observe: vi.fn() },
  activeUsersGauge: { set: vi.fn() },
  userRegistrationsTotal: { inc: vi.fn() },
  userLoginsTotal: { inc: vi.fn() },
  bookingsCreatedTotal: { inc: vi.fn() },
  toolsListedGauge: { set: vi.fn() },
  collectDefaultMetrics: vi.fn()
}));

import { bookingsService } from "../src/modules/bookings/bookings.service";
import { authRepository } from "../src/modules/auth/auth.repository";
import { bookingsCreatedTotal } from "../src/utils/metrics";

const mockedBookingsService = vi.mocked(bookingsService);
const mockedAuthRepository = vi.mocked(authRepository);
const mockedBookingsCreated = vi.mocked(bookingsCreatedTotal);

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("bookings controller – metrics instrumentation", () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "test-secret";
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    const { createApp } = await import("../src/app");
    app = createApp();
    token = jwt.sign({ userId: USER_ID, role: "USER" }, process.env.JWT_SECRET);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuthRepository.findById.mockResolvedValue({
      id: USER_ID,
      role: "USER",
      isSuspended: false
    } as never);
  });

  describe("POST /api/bookings/tool", () => {
    it("increments bookingsCreatedTotal on successful tool booking", async () => {
      mockedBookingsService.createToolBooking.mockResolvedValue({ id: "b1" } as never);

      await request(app)
        .post("/api/bookings/tool")
        .set("Authorization", `Bearer ${token}`)
        .send({
          toolId: "22222222-2222-2222-2222-222222222222",
          startDate: "2026-07-01T00:00:00.000Z",
          endDate: "2026-07-05T00:00:00.000Z",
          pickupTime: "2026-07-01T10:00:00.000Z"
        });

      expect(mockedBookingsCreated.inc).toHaveBeenCalledOnce();
    });

    it("does not increment bookingsCreatedTotal when service throws", async () => {
      mockedBookingsService.createToolBooking.mockRejectedValue(new Error("conflict"));

      await request(app)
        .post("/api/bookings/tool")
        .set("Authorization", `Bearer ${token}`)
        .send({
          toolId: "22222222-2222-2222-2222-222222222222",
          startDate: "2026-07-01T00:00:00.000Z",
          endDate: "2026-07-05T00:00:00.000Z",
          pickupTime: "2026-07-01T10:00:00.000Z"
        });

      expect(mockedBookingsCreated.inc).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/bookings/workshop", () => {
    const validWorkshopBody = {
      workshopId: "33333333-3333-3333-3333-333333333333",
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-01T02:00:00.000Z",
      workshopToolIds: ["44444444-4444-4444-4444-444444444444"]
    };

    it("increments bookingsCreatedTotal on successful workshop booking", async () => {
      mockedBookingsService.createWorkshopBooking.mockResolvedValue({ id: "b2" } as never);

      await request(app)
        .post("/api/bookings/workshop")
        .set("Authorization", `Bearer ${token}`)
        .send(validWorkshopBody);

      expect(mockedBookingsCreated.inc).toHaveBeenCalledOnce();
    });

    it("does not increment bookingsCreatedTotal when workshop booking service throws", async () => {
      mockedBookingsService.createWorkshopBooking.mockRejectedValue(new Error("full"));

      await request(app)
        .post("/api/bookings/workshop")
        .set("Authorization", `Bearer ${token}`)
        .send(validWorkshopBody);

      expect(mockedBookingsCreated.inc).not.toHaveBeenCalled();
    });
  });
});
