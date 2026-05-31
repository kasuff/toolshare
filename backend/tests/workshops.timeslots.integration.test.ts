import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import type { PrismaClient, Role } from "@prisma/client";

type TestUser = {
  id: string;
  role: Role;
  token: string;
  email: string;
};

type WorkshopDetail = {
  id: string;
  timeslots: Array<{
    id: string;
    startTime: string;
    endTime: string;
    blockedByOwner: boolean;
  }>;
};

const TEST_EMAIL_PREFIX = `workshop-timeslot-int-${Date.now()}`;

describe("Workshop timeslot integration", () => {
  let app: Express;
  let prisma: PrismaClient;
  let userCounter = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp();

    const prismaModule = await import("../src/config/prisma");
    prisma = prismaModule.prisma;
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: TEST_EMAIL_PREFIX
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: TEST_EMAIL_PREFIX
        }
      }
    });
    await prisma.$disconnect();
  });

  const issueToken = (userId: string, role: Role) =>
    jwt.sign(
      {
        userId,
        role
      },
      process.env.JWT_SECRET as string
    );

  const createUser = async (role: Role = "USER"): Promise<TestUser> => {
    userCounter += 1;
    const email = `${TEST_EMAIL_PREFIX}-${role.toLowerCase()}-${userCounter}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "integration-test-password-hash",
        name: `Integration User ${userCounter}`,
        address: "Integration Street 1",
        role
      }
    });

    return {
      id: user.id,
      role: user.role,
      token: issueToken(user.id, user.role),
      email: user.email
    };
  };

  const createWorkshop = async (owner: TestUser): Promise<{ id: string; workshopToolId: string }> => {
    const response = await request(app)
      .post("/api/workshops")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Integrations-Werkstatt",
        description: "Werkstatt fuer Integrations-Tests",
        location: "Muenchen",
        maxCapacity: 8,
        extras: ["WLAN", "Starkstrom"],
        workshopTools: [
          {
            name: "Akkuschrauber",
            category: "Elektrowerkzeuge"
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeTypeOf("string");

    const workshopTool = await prisma.workshopTool.findFirst({
      where: { workshopId: response.body.id as string },
      select: { id: true }
    });
    expect(workshopTool).toBeTruthy();

    return {
      id: response.body.id as string,
      workshopToolId: workshopTool!.id
    };
  };

  const createTimeslot = async (
    owner: TestUser,
    workshopId: string,
    input: { startTime: string; endTime: string; blockedByOwner?: boolean }
  ) => {
    return request(app)
      .post(`/api/workshops/${workshopId}/timeslots`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send(input);
  };

  const getWorkshopDetail = async (workshopId: string): Promise<WorkshopDetail> => {
    const response = await request(app).get(`/api/workshops/${workshopId}`);
    expect(response.status).toBe(200);
    return response.body as WorkshopDetail;
  };

  it("splits a long availability when a blocked interval is inserted", async () => {
    const owner = await createUser("USER");
    const workshop = await createWorkshop(owner);

    const availability = await createTimeslot(owner, workshop.id, {
      startTime: "2027-01-01T00:00:00.000Z",
      endTime: "2027-07-01T00:00:00.000Z"
    });
    expect(availability.status).toBe(201);
    expect(availability.body.blockedByOwner).toBe(false);

    const blocked = await createTimeslot(owner, workshop.id, {
      startTime: "2027-02-01T00:00:00.000Z",
      endTime: "2027-03-01T00:00:00.000Z",
      blockedByOwner: true
    });
    expect(blocked.status).toBe(201);
    expect(blocked.body.blockedByOwner).toBe(true);

    const detail = await getWorkshopDetail(workshop.id);
    expect(detail.timeslots).toHaveLength(3);

    const normalized = detail.timeslots.map((slot) => ({
      startTime: new Date(slot.startTime).toISOString(),
      endTime: new Date(slot.endTime).toISOString(),
      blockedByOwner: slot.blockedByOwner
    }));

    expect(normalized).toEqual([
      {
        startTime: "2027-01-01T00:00:00.000Z",
        endTime: "2027-02-01T00:00:00.000Z",
        blockedByOwner: false
      },
      {
        startTime: "2027-02-01T00:00:00.000Z",
        endTime: "2027-03-01T00:00:00.000Z",
        blockedByOwner: true
      },
      {
        startTime: "2027-03-01T00:00:00.000Z",
        endTime: "2027-07-01T00:00:00.000Z",
        blockedByOwner: false
      }
    ]);
  });

  it("returns TIMESLOT_CONFLICT when a blocked slot overlaps another blocked slot", async () => {
    const owner = await createUser("USER");
    const workshop = await createWorkshop(owner);

    const firstBlocked = await createTimeslot(owner, workshop.id, {
      startTime: "2027-04-01T00:00:00.000Z",
      endTime: "2027-04-15T00:00:00.000Z",
      blockedByOwner: true
    });
    expect(firstBlocked.status).toBe(201);

    const overlappingBlocked = await createTimeslot(owner, workshop.id, {
      startTime: "2027-04-10T00:00:00.000Z",
      endTime: "2027-04-20T00:00:00.000Z",
      blockedByOwner: true
    });
    expect(overlappingBlocked.status).toBe(409);
    expect(overlappingBlocked.body).toMatchObject({
      error: {
        code: "TIMESLOT_CONFLICT",
        status: 409
      }
    });
  });

  it("returns ACTIVE_BOOKING_EXISTS when blocking would split a slot with active booking", async () => {
    const owner = await createUser("USER");
    const requester = await createUser("USER");
    const workshop = await createWorkshop(owner);

    const availability = await createTimeslot(owner, workshop.id, {
      startTime: "2027-05-01T00:00:00.000Z",
      endTime: "2027-06-01T00:00:00.000Z"
    });
    expect(availability.status).toBe(201);
    expect(availability.body.id).toBeTypeOf("string");

    const booking = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        workshopId: workshop.id,
        startDate: "2027-05-05T00:00:00.000Z",
        endDate: "2027-05-15T00:00:00.000Z",
        workshopToolIds: [workshop.workshopToolId]
      });
    expect(booking.status).toBe(201);

    const blockedInsert = await createTimeslot(owner, workshop.id, {
      startTime: "2027-05-10T00:00:00.000Z",
      endTime: "2027-05-20T00:00:00.000Z",
      blockedByOwner: true
    });
    expect(blockedInsert.status).toBe(409);
    expect(blockedInsert.body).toMatchObject({
      error: {
        code: "ACTIVE_BOOKING_EXISTS",
        status: 409
      }
    });

    const detail = await getWorkshopDetail(workshop.id);
    expect(detail.timeslots).toHaveLength(1);
    expect(detail.timeslots[0]?.blockedByOwner).toBe(false);
    expect(new Date(detail.timeslots[0]!.startTime).toISOString()).toBe("2027-05-01T00:00:00.000Z");
    expect(new Date(detail.timeslots[0]!.endTime).toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("rejects workshop bookings for owner-blocked timeslots", async () => {
    const owner = await createUser("USER");
    const requester = await createUser("USER");
    const workshop = await createWorkshop(owner);

    const blocked = await createTimeslot(owner, workshop.id, {
      startTime: "2027-08-01T09:00:00.000Z",
      endTime: "2027-08-01T17:00:00.000Z",
      blockedByOwner: true
    });
    expect(blocked.status).toBe(201);

    const bookingAttempt = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${requester.token}`)
      .send({
        workshopId: workshop.id,
        startDate: "2027-08-01T09:00:00.000Z",
        endDate: "2027-08-01T17:00:00.000Z",
        workshopToolIds: [workshop.workshopToolId]
      });

    expect(bookingAttempt.status).toBe(409);
    expect(bookingAttempt.body).toMatchObject({
      error: {
        code: "TIMESLOT_BLOCKED",
        status: 409
      }
    });

    const blockedBookingCount = await prisma.booking.count({
      where: {
        timeslotId: blocked.body.id as string
      }
    });
    expect(blockedBookingCount).toBe(0);
  });
});
