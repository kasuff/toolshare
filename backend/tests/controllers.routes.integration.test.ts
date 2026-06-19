import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { authRepository } from "../src/modules/auth/auth.repository";
import { toolsService } from "../src/modules/tools/tools.service";
import { workshopsService } from "../src/modules/workshops/workshops.service";
import { ratingsService } from "../src/modules/ratings/ratings.service";
import { moderationService } from "../src/modules/moderation/moderation.service";
import { notificationsService } from "../src/modules/notifications/notifications.service";
import { usersService } from "../src/modules/users/users.service";
import { authService } from "../src/modules/auth/auth.service";
import { bookingsService } from "../src/modules/bookings/bookings.service";

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findById: vi.fn()
  }
}));

vi.mock("../src/modules/tools/tools.service", () => ({
  toolsService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock("../src/modules/workshops/workshops.service", () => ({
  workshopsService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    createTimeslot: vi.fn(),
    removeTimeslot: vi.fn()
  }
}));

vi.mock("../src/modules/ratings/ratings.service", () => ({
  ratingsService: {
    create: vi.fn(),
    listReceived: vi.fn(),
    listGiven: vi.fn(),
    listForTool: vi.fn(),
    listForWorkshop: vi.fn()
  }
}));

vi.mock("../src/modules/moderation/moderation.service", () => ({
  moderationService: {
    createReport: vi.fn(),
    listReports: vi.fn(),
    listClosedReports: vi.fn(),
    updateReportStatus: vi.fn()
  }
}));

vi.mock("../src/modules/notifications/notifications.service", () => ({
  notificationsService: {
    listForUser: vi.fn(),
    markAsRead: vi.fn()
  }
}));

vi.mock("../src/modules/users/users.service", () => ({
  usersService: {
    getAdminMetrics: vi.fn(),
    listUsers: vi.fn(),
    getMyProfile: vi.fn(),
    getById: vi.fn(),
    updateMyProfile: vi.fn(),
    updateRole: vi.fn(),
    updateSuspension: vi.fn()
  }
}));

vi.mock("../src/modules/auth/auth.service", () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    changePassword: vi.fn()
  }
}));

vi.mock("../src/modules/bookings/bookings.service", () => ({
  bookingsService: {
    listForUserContext: vi.fn(),
    createToolBooking: vi.fn(),
    createToolOwnerBlock: vi.fn(),
    createWorkshopBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    createPickupProposal: vi.fn(),
    respondPickupProposal: vi.fn(),
    createTimeslotProposal: vi.fn(),
    respondTimeslotProposal: vi.fn()
  }
}));

const mockedAuthRepository = vi.mocked(authRepository);
const mockedToolsService = vi.mocked(toolsService);
const mockedWorkshopsService = vi.mocked(workshopsService);
const mockedRatingsService = vi.mocked(ratingsService);
const mockedModerationService = vi.mocked(moderationService);
const mockedNotificationsService = vi.mocked(notificationsService);
const mockedUsersService = vi.mocked(usersService);
const mockedAuthService = vi.mocked(authService);
const mockedBookingsService = vi.mocked(bookingsService);

const MANAGER_ID = "11111111-1111-1111-1111-111111111111";
const TOOL_ID = "22222222-2222-2222-2222-222222222222";
const WORKSHOP_ID = "33333333-3333-3333-3333-333333333333";
const SLOT_ID = "44444444-4444-4444-4444-444444444444";
const BOOKING_ID = "55555555-5555-5555-5555-555555555555";
const REPORT_ID = "66666666-6666-6666-6666-666666666666";
const NOTIFICATION_ID = "77777777-7777-7777-7777-777777777777";
const TARGET_USER_ID = "88888888-8888-8888-8888-888888888888";
const USER_ID = "99999999-9999-9999-9999-999999999999";
const PROPOSAL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("Controller route integration coverage", () => {
  let app: Express;

  const managerToken = () =>
    jwt.sign(
      {
        userId: MANAGER_ID,
        role: "MANAGER"
      },
      process.env.JWT_SECRET as string
    );

  const userToken = () =>
    jwt.sign(
      {
        userId: USER_ID,
        role: "USER"
      },
      process.env.JWT_SECRET as string
    );

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuthRepository.findById.mockImplementation(async (id) => {
      if (id === MANAGER_ID) {
        return { id: MANAGER_ID, role: "MANAGER", isSuspended: false } as any;
      }
      if (id === USER_ID) {
        return { id: USER_ID, role: "USER", isSuspended: false } as any;
      }
      return null;
    });
  });

  describe("tools controller routes", () => {
    it("handles list and getById", async () => {
      mockedToolsService.list.mockResolvedValueOnce([{ id: TOOL_ID }] as any);
      mockedToolsService.getById.mockResolvedValueOnce({ id: TOOL_ID } as any);

      const listResponse = await request(app)
        .get("/api/tools")
        .query({ category: "Holz", status: "AVAILABLE", ownerId: MANAGER_ID, search: "bohr" });
      const getResponse = await request(app).get(`/api/tools/${TOOL_ID}`);

      expect(listResponse.status).toBe(200);
      expect(getResponse.status).toBe(200);
      expect(mockedToolsService.list).toHaveBeenCalledWith({
        category: "Holz",
        status: "AVAILABLE",
        ownerId: MANAGER_ID,
        search: "bohr"
      });
      expect(mockedToolsService.getById).toHaveBeenCalledWith(TOOL_ID);
    });

    it("handles create, update and remove", async () => {
      mockedToolsService.create.mockResolvedValueOnce({ id: TOOL_ID } as any);
      mockedToolsService.update.mockResolvedValueOnce({ id: TOOL_ID, name: "Neu" } as any);
      mockedToolsService.remove.mockResolvedValueOnce(undefined);

      const createResponse = await request(app)
        .post("/api/tools")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          name: "Bohrmaschine",
          description: "Leistungsstarkes Werkzeug",
          category: "Elektro",
          imageUrl: "https://example.com/tool.png",
          pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
          pickupLocationNote: "4. Stock"
        });

      const updateResponse = await request(app)
        .patch(`/api/tools/${TOOL_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          description: "Aktualisierte Beschreibung"
        });

      const removeResponse = await request(app)
        .delete(`/api/tools/${TOOL_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(createResponse.status).toBe(201);
      expect(updateResponse.status).toBe(200);
      expect(removeResponse.status).toBe(204);
      expect(mockedToolsService.create).toHaveBeenCalledWith({
        ownerId: MANAGER_ID,
        name: "Bohrmaschine",
        description: "Leistungsstarkes Werkzeug",
        category: "Elektro",
        imageUrl: "https://example.com/tool.png",
        pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
        pickupLocationNote: "4. Stock"
      });
      expect(mockedToolsService.update).toHaveBeenCalledWith({
        toolId: TOOL_ID,
        actorId: MANAGER_ID,
        actorRole: "MANAGER",
        data: {
          name: undefined,
          description: "Aktualisierte Beschreibung",
          category: undefined,
          imageUrl: undefined,
          pickupLocation: undefined,
          pickupLocationNote: undefined,
          status: undefined
        }
      });
      expect(mockedToolsService.remove).toHaveBeenCalledWith({
        toolId: TOOL_ID,
        actorId: MANAGER_ID,
        actorRole: "MANAGER"
      });
    });
  });

  describe("workshops controller routes", () => {
    it("handles list and getById", async () => {
      mockedWorkshopsService.list.mockResolvedValueOnce([{ id: WORKSHOP_ID }] as any);
      mockedWorkshopsService.getById.mockResolvedValueOnce({ id: WORKSHOP_ID } as any);

      const listResponse = await request(app)
        .get("/api/workshops")
        .query({ managerId: MANAGER_ID, location: "Muenchen", search: "holz" });
      const getResponse = await request(app).get(`/api/workshops/${WORKSHOP_ID}`);

      expect(listResponse.status).toBe(200);
      expect(getResponse.status).toBe(200);
      expect(mockedWorkshopsService.list).toHaveBeenCalledWith({
        managerId: MANAGER_ID,
        location: "Muenchen",
        search: "holz"
      });
      expect(mockedWorkshopsService.getById).toHaveBeenCalledWith(WORKSHOP_ID);
    });

    it("handles create, update and remove", async () => {
      mockedWorkshopsService.create.mockResolvedValueOnce({ id: WORKSHOP_ID } as any);
      mockedWorkshopsService.update.mockResolvedValueOnce({ id: WORKSHOP_ID, name: "Werkstatt Neu" } as any);
      mockedWorkshopsService.remove.mockResolvedValueOnce(undefined);

      const createResponse = await request(app)
        .post("/api/workshops")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          name: "Werkstatt A",
          description: "Gemeinschaftswerkstatt",
          location: "Muenchen",
          maxCapacity: 4
        });

      const updateResponse = await request(app)
        .patch(`/api/workshops/${WORKSHOP_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          location: "Muenchen Nord"
        });

      const removeResponse = await request(app)
        .delete(`/api/workshops/${WORKSHOP_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(createResponse.status).toBe(201);
      expect(updateResponse.status).toBe(200);
      expect(removeResponse.status).toBe(204);
      expect(mockedWorkshopsService.create).toHaveBeenCalledWith({
        managerId: MANAGER_ID,
        name: "Werkstatt A",
        description: "Gemeinschaftswerkstatt",
        location: "Muenchen",
        maxCapacity: 4
      });
      expect(mockedWorkshopsService.update).toHaveBeenCalledWith({
        workshopId: WORKSHOP_ID,
        managerId: MANAGER_ID,
        actorRole: "MANAGER",
        data: {
          name: undefined,
          description: undefined,
          location: "Muenchen Nord",
          maxCapacity: undefined
        }
      });
      expect(mockedWorkshopsService.remove).toHaveBeenCalledWith({
        workshopId: WORKSHOP_ID,
        managerId: MANAGER_ID,
        actorRole: "MANAGER"
      });
    });

    it("handles createTimeslot and removeTimeslot", async () => {
      mockedWorkshopsService.createTimeslot.mockResolvedValueOnce({ id: SLOT_ID } as any);
      mockedWorkshopsService.removeTimeslot.mockResolvedValueOnce(undefined);

      const createTimeslotResponse = await request(app)
        .post(`/api/workshops/${WORKSHOP_ID}/timeslots`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          startTime: "2026-06-01T10:00:00.000Z",
          endTime: "2026-06-01T12:00:00.000Z"
        });

      const removeTimeslotResponse = await request(app)
        .delete(`/api/workshops/${WORKSHOP_ID}/timeslots/${SLOT_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(createTimeslotResponse.status).toBe(201);
      expect(removeTimeslotResponse.status).toBe(204);
      expect(mockedWorkshopsService.createTimeslot).toHaveBeenCalledWith({
        workshopId: WORKSHOP_ID,
        managerId: MANAGER_ID,
        actorRole: "MANAGER",
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T12:00:00.000Z"
      });
      expect(mockedWorkshopsService.removeTimeslot).toHaveBeenCalledWith({
        workshopId: WORKSHOP_ID,
        timeslotId: SLOT_ID,
        managerId: MANAGER_ID,
        actorRole: "MANAGER"
      });
    });
  });

  describe("ratings controller routes", () => {
    it("handles create + list endpoints", async () => {
      mockedRatingsService.create.mockResolvedValueOnce({ id: "rating-1" } as any);
      mockedRatingsService.listReceived.mockResolvedValueOnce([{ id: "rating-r" }] as any);
      mockedRatingsService.listGiven.mockResolvedValueOnce([{ id: "rating-g" }] as any);
      mockedRatingsService.listReceived.mockResolvedValueOnce([{ id: "rating-user" }] as any);

      const createResponse = await request(app)
        .post("/api/ratings")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          bookingId: BOOKING_ID,
          score: 5,
          comment: "Top"
        });
      const receivedResponse = await request(app)
        .get("/api/ratings/me/received")
        .set("Authorization", `Bearer ${managerToken()}`);
      const givenResponse = await request(app)
        .get("/api/ratings/me/given")
        .set("Authorization", `Bearer ${managerToken()}`);
      const forUserResponse = await request(app)
        .get(`/api/ratings/users/${TARGET_USER_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(createResponse.status).toBe(201);
      expect(receivedResponse.status).toBe(200);
      expect(givenResponse.status).toBe(200);
      expect(forUserResponse.status).toBe(200);
      expect(mockedRatingsService.create).toHaveBeenCalledWith({
        bookingId: BOOKING_ID,
        fromUserId: MANAGER_ID,
        score: 5,
        comment: "Top"
      });
      expect(mockedRatingsService.listReceived).toHaveBeenNthCalledWith(1, MANAGER_ID);
      expect(mockedRatingsService.listGiven).toHaveBeenCalledWith(MANAGER_ID);
      expect(mockedRatingsService.listReceived).toHaveBeenNthCalledWith(2, TARGET_USER_ID);
    });

    it("handles public list endpoints for tools and workshops", async () => {
      mockedRatingsService.listForTool.mockResolvedValueOnce([{ id: "rating-tool" }] as any);
      mockedRatingsService.listForWorkshop.mockResolvedValueOnce([{ id: "rating-workshop" }] as any);

      const toolResponse = await request(app).get(`/api/ratings/tools/${TOOL_ID}`);
      const workshopResponse = await request(app).get(`/api/ratings/workshops/${WORKSHOP_ID}`);

      expect(toolResponse.status).toBe(200);
      expect(workshopResponse.status).toBe(200);
      expect(mockedRatingsService.listForTool).toHaveBeenCalledWith(TOOL_ID);
      expect(mockedRatingsService.listForWorkshop).toHaveBeenCalledWith(WORKSHOP_ID);
    });
  });

  describe("moderation controller routes", () => {
    it("handles report create/list/update", async () => {
      mockedModerationService.createReport.mockResolvedValueOnce({ id: REPORT_ID } as any);
      mockedModerationService.listReports.mockResolvedValueOnce([{ id: REPORT_ID }] as any);
      mockedModerationService.listClosedReports.mockResolvedValueOnce([{ id: "closed-1" }] as any);
      mockedModerationService.updateReportStatus.mockResolvedValueOnce({ id: REPORT_ID, status: "RESOLVED" } as any);

      const createResponse = await request(app)
        .post("/api/moderation/reports")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({
          targetType: "USER",
          targetId: TARGET_USER_ID,
          bookingId: BOOKING_ID,
          reason: "Spam report",
          details: "Details"
        });

      const listResponse = await request(app)
        .get("/api/moderation/reports")
        .set("Authorization", `Bearer ${managerToken()}`);

      const closedResponse = await request(app)
        .get("/api/moderation/reports/closed")
        .set("Authorization", `Bearer ${managerToken()}`);

      const updateResponse = await request(app)
        .patch(`/api/moderation/reports/${REPORT_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ status: "RESOLVED" });

      expect(createResponse.status).toBe(201);
      expect(listResponse.status).toBe(200);
      expect(closedResponse.status).toBe(200);
      expect(updateResponse.status).toBe(200);
      expect(mockedModerationService.createReport).toHaveBeenCalledWith({
        reporterId: MANAGER_ID,
        targetType: "USER",
        targetId: TARGET_USER_ID,
        bookingId: BOOKING_ID,
        reason: "Spam report",
        details: "Details"
      });
      expect(mockedModerationService.listReports).toHaveBeenCalledTimes(1);
      expect(mockedModerationService.listClosedReports).toHaveBeenCalledTimes(1);
      expect(mockedModerationService.updateReportStatus).toHaveBeenCalledWith({
        reportId: REPORT_ID,
        status: "RESOLVED",
        moderatorId: MANAGER_ID,
        decisionNote: undefined,
        warnUserId: undefined,
        warningReason: undefined
      });
    });
  });

  describe("notifications controller routes", () => {
    it("handles listMine and markRead", async () => {
      mockedNotificationsService.listForUser.mockResolvedValueOnce([{ id: NOTIFICATION_ID }] as any);
      mockedNotificationsService.markAsRead.mockResolvedValueOnce(undefined);

      const listResponse = await request(app)
        .get("/api/notifications/me")
        .set("Authorization", `Bearer ${managerToken()}`);
      const markReadResponse = await request(app)
        .patch(`/api/notifications/${NOTIFICATION_ID}/read`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({});

      expect(listResponse.status).toBe(200);
      expect(markReadResponse.status).toBe(204);
      expect(mockedNotificationsService.listForUser).toHaveBeenCalledWith(MANAGER_ID);
      expect(mockedNotificationsService.markAsRead).toHaveBeenCalledWith(MANAGER_ID, NOTIFICATION_ID);
    });
  });

  describe("users controller routes", () => {
    it("handles profile and admin/list endpoints", async () => {
      mockedUsersService.getMyProfile.mockResolvedValueOnce({ id: MANAGER_ID } as any);
      mockedUsersService.updateMyProfile.mockResolvedValueOnce({ id: MANAGER_ID, name: "Lea Neu" } as any);
      mockedUsersService.getAdminMetrics.mockResolvedValueOnce({
        users: 10,
        tools: 20,
        workshops: 3,
        openBookings: 1,
        openReports: 0
      } as any);
      mockedUsersService.listUsers.mockResolvedValueOnce([{ id: TARGET_USER_ID }] as any);
      mockedUsersService.getById.mockResolvedValueOnce({ id: TARGET_USER_ID } as any);

      const myProfileResponse = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${managerToken()}`);
      const updateMyProfileResponse = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ name: "Lea Neu" });
      const metricsResponse = await request(app)
        .get("/api/users/admin/metrics")
        .set("Authorization", `Bearer ${managerToken()}`);
      const listResponse = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${managerToken()}`)
        .query({ role: "USER", search: "lea" });
      const getByIdResponse = await request(app)
        .get(`/api/users/${TARGET_USER_ID}`)
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(myProfileResponse.status).toBe(200);
      expect(updateMyProfileResponse.status).toBe(200);
      expect(metricsResponse.status).toBe(200);
      expect(listResponse.status).toBe(200);
      expect(getByIdResponse.status).toBe(200);
      expect(mockedUsersService.getMyProfile).toHaveBeenCalledWith(MANAGER_ID);
      expect(mockedUsersService.updateMyProfile).toHaveBeenCalledWith({
        userId: MANAGER_ID,
        name: "Lea Neu",
        address: undefined
      });
      expect(mockedUsersService.getAdminMetrics).toHaveBeenCalledTimes(1);
      expect(mockedUsersService.listUsers).toHaveBeenCalledWith({ role: "USER", search: "lea" });
      expect(mockedUsersService.getById).toHaveBeenCalledWith(TARGET_USER_ID);
    });

    it("handles manager-only role and suspension endpoints", async () => {
      mockedUsersService.updateRole.mockResolvedValueOnce({
        id: TARGET_USER_ID,
        role: "MODERATOR"
      } as any);
      mockedUsersService.updateSuspension.mockResolvedValueOnce({
        id: TARGET_USER_ID,
        isSuspended: true
      } as any);

      const roleResponse = await request(app)
        .patch(`/api/users/${TARGET_USER_ID}/role`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ role: "MODERATOR" });
      const suspensionResponse = await request(app)
        .patch(`/api/users/${TARGET_USER_ID}/suspension`)
        .set("Authorization", `Bearer ${managerToken()}`)
        .send({ isSuspended: true });

      expect(roleResponse.status).toBe(200);
      expect(suspensionResponse.status).toBe(200);
      expect(mockedUsersService.updateRole).toHaveBeenCalledWith({
        actorId: MANAGER_ID,
        targetUserId: TARGET_USER_ID,
        role: "MODERATOR"
      });
      expect(mockedUsersService.updateSuspension).toHaveBeenCalledWith({
        targetUserId: TARGET_USER_ID,
        isSuspended: true
      });
    });

    it("rejects role and suspension updates from non-managers", async () => {
      const moderatorToken = () =>
        jwt.sign(
          {
            userId: USER_ID,
            role: "MODERATOR"
          },
          process.env.JWT_SECRET as string
        );

      mockedAuthRepository.findById.mockResolvedValueOnce({
        id: USER_ID,
        role: "MODERATOR",
        isSuspended: false
      } as any);

      const roleResponse = await request(app)
        .patch(`/api/users/${TARGET_USER_ID}/role`)
        .set("Authorization", `Bearer ${moderatorToken()}`)
        .send({ role: "MODERATOR" });
      const suspensionResponse = await request(app)
        .patch(`/api/users/${TARGET_USER_ID}/suspension`)
        .set("Authorization", `Bearer ${moderatorToken()}`)
        .send({ isSuspended: true });

      expect(roleResponse.status).toBe(403);
      expect(suspensionResponse.status).toBe(403);
      expect(mockedUsersService.updateRole).not.toHaveBeenCalled();
      expect(mockedUsersService.updateSuspension).not.toHaveBeenCalled();
    });
  });

  describe("auth controller routes", () => {
    it("handles register, login and refresh", async () => {
      mockedAuthService.register.mockResolvedValueOnce({
        user: { id: USER_ID, email: "new@example.com", role: "USER", name: "Neu" },
        accessToken: "access-new",
        refreshToken: "refresh-new"
      } as any);
      mockedAuthService.login.mockResolvedValueOnce({
        user: { id: USER_ID, email: "new@example.com", role: "USER", name: "Neu" },
        accessToken: "access-login",
        refreshToken: "refresh-login"
      } as any);
      mockedAuthService.refresh.mockResolvedValueOnce({
        accessToken: "access-refreshed",
        refreshToken: "refresh-refreshed"
      } as any);

      const registerResponse = await request(app).post("/api/auth/register").send({
        email: "new@example.com",
        password: "Register123!",
        name: "Neu",
        address: "Neue Straße 5"
      });
      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "new@example.com",
        password: "Register123!"
      });
      const refreshResponse = await request(app).post("/api/auth/refresh").send({
        refreshToken: "refresh-login"
      });

      expect(registerResponse.status).toBe(201);
      expect(loginResponse.status).toBe(200);
      expect(refreshResponse.status).toBe(200);
      expect(mockedAuthService.register).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "Register123!",
        name: "Neu",
        address: "Neue Straße 5"
      });
      expect(mockedAuthService.login).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "Register123!"
      });
      expect(mockedAuthService.refresh).toHaveBeenCalledWith("refresh-login");
    });

    it("handles change-password for authenticated users", async () => {
      mockedAuthService.changePassword.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${userToken()}`)
        .send({
          currentPassword: "OldPass123!",
          newPassword: "NewPass1234!"
        });

      expect(response.status).toBe(204);
      expect(mockedAuthService.changePassword).toHaveBeenCalledWith({
        userId: USER_ID,
        currentPassword: "OldPass123!",
        newPassword: "NewPass1234!"
      });
    });
  });

  describe("bookings controller routes", () => {
    it("handles listMine and booking creation endpoints", async () => {
      mockedBookingsService.listForUserContext.mockResolvedValueOnce([{ id: BOOKING_ID }] as any);
      mockedBookingsService.createToolBooking.mockResolvedValueOnce({ id: BOOKING_ID } as any);
      mockedBookingsService.createToolOwnerBlock.mockResolvedValueOnce({ id: "block-1" } as any);
      mockedBookingsService.createWorkshopBooking.mockResolvedValueOnce({ id: "workshop-booking-1" } as any);

      const listResponse = await request(app)
        .get("/api/bookings/me")
        .set("Authorization", `Bearer ${userToken()}`);
      const toolResponse = await request(app)
        .post("/api/bookings/tool")
        .set("Authorization", `Bearer ${userToken()}`)
        .send({
          toolId: TOOL_ID,
          startDate: "2026-07-01T00:00:00.000Z",
          endDate: "2026-07-05T00:00:00.000Z",
          pickupTime: "2026-07-01T10:00:00.000Z"
        });
      const blockResponse = await request(app)
        .post("/api/bookings/tool-owner-block")
        .set("Authorization", `Bearer ${userToken()}`)
        .send({
          toolId: TOOL_ID,
          startDate: "2026-07-10T00:00:00.000Z",
          endDate: "2026-07-12T00:00:00.000Z"
        });
      const workshopResponse = await request(app)
        .post("/api/bookings/workshop")
        .set("Authorization", `Bearer ${userToken()}`)
        .send({
          workshopId: WORKSHOP_ID,
          startDate: "2026-07-01T00:00:00.000Z",
          endDate: "2026-07-01T02:00:00.000Z"
        });

      expect(listResponse.status).toBe(200);
      expect(toolResponse.status).toBe(201);
      expect(blockResponse.status).toBe(201);
      expect(workshopResponse.status).toBe(201);
      expect(mockedBookingsService.listForUserContext).toHaveBeenCalledWith(USER_ID);
      expect(mockedBookingsService.createToolBooking).toHaveBeenCalledWith({
        requesterId: USER_ID,
        toolId: TOOL_ID,
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-05T00:00:00.000Z",
        pickupTime: "2026-07-01T10:00:00.000Z"
      });
      expect(mockedBookingsService.createToolOwnerBlock).toHaveBeenCalledWith({
        ownerId: USER_ID,
        toolId: TOOL_ID,
        startDate: "2026-07-10T00:00:00.000Z",
        endDate: "2026-07-12T00:00:00.000Z"
      });
      expect(mockedBookingsService.createWorkshopBooking).toHaveBeenCalledWith({
        requesterId: USER_ID,
        workshopId: WORKSHOP_ID,
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-01T02:00:00.000Z",
        workshopToolIds: []
      });
    });

    it("handles status updates and proposal flows", async () => {
      mockedBookingsService.updateBookingStatus.mockResolvedValueOnce({ id: BOOKING_ID, status: "ACCEPTED" } as any);
      mockedBookingsService.createPickupProposal.mockResolvedValueOnce({ id: PROPOSAL_ID } as any);
      mockedBookingsService.respondPickupProposal.mockResolvedValueOnce({ id: BOOKING_ID, status: "ACCEPTED" } as any);
      mockedBookingsService.createTimeslotProposal.mockResolvedValueOnce({ id: PROPOSAL_ID } as any);
      mockedBookingsService.respondTimeslotProposal.mockResolvedValueOnce({ id: BOOKING_ID, status: "ACCEPTED" } as any);

      const statusResponse = await request(app)
        .patch(`/api/bookings/${BOOKING_ID}/status`)
        .set("Authorization", `Bearer ${userToken()}`)
        .send({ status: "ACCEPTED" });
      const pickupCreateResponse = await request(app)
        .post(`/api/bookings/${BOOKING_ID}/pickup-proposals`)
        .set("Authorization", `Bearer ${userToken()}`)
        .send({
          pickupTime: "2026-07-01T10:00:00.000Z",
          returnTime: "2026-07-05T18:00:00.000Z"
        });
      const pickupRespondResponse = await request(app)
        .patch(`/api/bookings/${BOOKING_ID}/pickup-proposals/${PROPOSAL_ID}`)
        .set("Authorization", `Bearer ${userToken()}`)
        .send({ decision: "ACCEPT" });
      const timeslotCreateResponse = await request(app)
        .post(`/api/bookings/${BOOKING_ID}/timeslot-proposals`)
        .set("Authorization", `Bearer ${userToken()}`)
        .send({
          startDate: "2026-07-02T08:00:00.000Z",
          endDate: "2026-07-02T12:00:00.000Z"
        });
      const timeslotRespondResponse = await request(app)
        .patch(`/api/bookings/${BOOKING_ID}/timeslot-proposals/${PROPOSAL_ID}`)
        .set("Authorization", `Bearer ${userToken()}`)
        .send({ decision: "DECLINE" });

      expect(statusResponse.status).toBe(200);
      expect(pickupCreateResponse.status).toBe(201);
      expect(pickupRespondResponse.status).toBe(200);
      expect(timeslotCreateResponse.status).toBe(201);
      expect(timeslotRespondResponse.status).toBe(200);
      expect(mockedBookingsService.updateBookingStatus).toHaveBeenCalledWith({
        actorId: USER_ID,
        actorRole: "USER",
        bookingId: BOOKING_ID,
        status: "ACCEPTED"
      });
      expect(mockedBookingsService.createPickupProposal).toHaveBeenCalledWith({
        actorId: USER_ID,
        bookingId: BOOKING_ID,
        pickupTime: "2026-07-01T10:00:00.000Z",
        returnTime: "2026-07-05T18:00:00.000Z"
      });
      expect(mockedBookingsService.respondPickupProposal).toHaveBeenCalledWith({
        actorId: USER_ID,
        bookingId: BOOKING_ID,
        proposalId: PROPOSAL_ID,
        decision: "ACCEPT"
      });
      expect(mockedBookingsService.createTimeslotProposal).toHaveBeenCalledWith({
        actorId: USER_ID,
        bookingId: BOOKING_ID,
        startDate: "2026-07-02T08:00:00.000Z",
        endDate: "2026-07-02T12:00:00.000Z"
      });
      expect(mockedBookingsService.respondTimeslotProposal).toHaveBeenCalledWith({
        actorId: USER_ID,
        bookingId: BOOKING_ID,
        proposalId: PROPOSAL_ID,
        decision: "DECLINE"
      });
    });
  });
});
