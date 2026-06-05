import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";

let app: Express;
let prisma: PrismaClient;

async function registerAndLogin(appInstance: Express, email: string, password: string, name: string) {
  await request(appInstance).post("/api/auth/register").send({
    email,
    password,
    name,
    address: "Test Street 1"
  });
  const login = await request(appInstance).post("/api/auth/login").send({ email, password });
  return login.body.accessToken as string;
}

describe.skip("Booking conflict handling (tool + workshop)", () => {
  const seed = Date.now();
  const ownerEmail = `booking-owner-${seed}@example.com`;
  const requesterEmail = `booking-requester-${seed}@example.com`;
  const password = "Test1234!";

  let ownerToken: string;
  let requesterToken: string;
  let secondRequesterToken: string;
  let toolId: string;
  let workshopId: string;
  let workshopToolId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp() as Express;

    const prismaModule = await import("../src/config/prisma");
    prisma = prismaModule.prisma;

    ownerToken = await registerAndLogin(app, ownerEmail, password, "Owner");
    requesterToken = await registerAndLogin(app, requesterEmail, password, "Requester");
    secondRequesterToken = await registerAndLogin(
      app,
      `booking-requester-2-${seed}@example.com`,
      password,
      "Requester Two"
    );

    const toolResponse = await request(app)
      .post("/api/tools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Bohrmaschine",
        description: "Leistungsstarke Bohrmaschine",
        category: "elektro",
        pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
        pickupLocationNote: "Klingeln bei Owner"
      });
    expect(toolResponse.status).toBe(201);
    toolId = toolResponse.body.id as string;

    const workshopResponse = await request(app)
      .post("/api/workshops")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Holzwerkstatt",
        description: "Gemeinsame Werkstatt",
        location: "Muenchen",
        maxCapacity: 4,
        workshopTools: [
          {
            name: "Akkuschrauber",
            category: "elektro"
          }
        ]
      });
    expect(workshopResponse.status).toBe(201);

    const slotResponse = await request(app)
      .post(`/api/workshops/${workshopResponse.body.id as string}/timeslots`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        startTime: "2026-08-01T09:00:00.000Z",
        endTime: "2026-08-01T17:00:00.000Z"
      });
    expect(slotResponse.status).toBe(201);
    workshopId = workshopResponse.body.id as string;

    const workshopTool = await prisma.workshopTool.findFirst({
      where: { workshopId: workshopResponse.body.id as string },
      select: { id: true }
    });
    expect(workshopTool).toBeTruthy();
    workshopToolId = workshopTool!.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: {
        user: {
          email: {
            in: [
              ownerEmail,
              requesterEmail,
              `booking-requester-2-${seed}@example.com`
            ]
          }
        }
      }
    });
    await prisma.timeSlot.deleteMany({
      where: { workshop: { manager: { email: ownerEmail } } }
    });
    await prisma.workshop.deleteMany({
      where: { manager: { email: ownerEmail } }
    });
    await prisma.tool.deleteMany({
      where: { owner: { email: ownerEmail } }
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [ownerEmail, requesterEmail, `booking-requester-2-${seed}@example.com`]
        }
      }
    });
    await prisma.$disconnect();
  });

  it("creates a tool booking and rejects an overlapping second request with 409", async () => {
    const first = await request(app)
      .post("/api/bookings/tool")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        toolId,
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-05T18:00:00.000Z",
        pickupTime: "2026-06-01T14:00:00.000Z"
      });

    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post("/api/bookings/tool")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({
        toolId,
        startDate: "2026-06-03T10:00:00.000Z",
        endDate: "2026-06-07T18:00:00.000Z",
        pickupTime: "2026-06-03T14:00:00.000Z"
      });

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      error: {
        code: "BOOKING_CONFLICT",
        status: 409,
        message: "Im gewaehlten Zeitraum ist bereits eine Buchung vorhanden."
      }
    });

    const nonOverlap = await request(app)
      .post("/api/bookings/tool")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({
        toolId,
        startDate: "2026-07-01T10:00:00.000Z",
        endDate: "2026-07-05T18:00:00.000Z",
        pickupTime: "2026-07-01T14:00:00.000Z"
      });

    expect(nonOverlap.status).toBe(201);
  });

  it("creates a workshop booking and rejects a second overlapping booking with 409", async () => {
    const first = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        workshopId,
        startDate: "2026-08-01T09:00:00.000Z",
        endDate: "2026-08-01T17:00:00.000Z",
        workshopToolIds: [workshopToolId]
      });

    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({
        workshopId,
        startDate: "2026-08-01T12:00:00.000Z",
        endDate: "2026-08-01T15:00:00.000Z",
        workshopToolIds: [workshopToolId]
      });

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      error: {
        code: "BOOKING_CONFLICT",
        status: 409,
        message: "Im gewaehlten Zeitraum ist bereits eine Buchung vorhanden."
      }
    });
  });
});
