import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { isoDaysFromNow } from "./helpers/booking-dates";

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

describe("Booking conflict handling (tool + workshop)", () => {
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
  let workshopSlotStart: string;
  let workshopSlotEnd: string;

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

    // Innerhalb der echten Systemregeln: min. 12h Vorlauf, max. 60 Tage Vorausbuchung.
    workshopSlotStart = isoDaysFromNow(35, 9);
    workshopSlotEnd = isoDaysFromNow(35, 17);

    const slotResponse = await request(app)
      .post(`/api/workshops/${workshopResponse.body.id as string}/timeslots`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        startTime: workshopSlotStart,
        endTime: workshopSlotEnd
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
        startDate: isoDaysFromNow(3),
        endDate: isoDaysFromNow(7, 18),
        pickupTime: isoDaysFromNow(3, 14)
      });

    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post("/api/bookings/tool")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({
        toolId,
        startDate: isoDaysFromNow(5),
        endDate: isoDaysFromNow(9, 18),
        pickupTime: isoDaysFromNow(5, 14)
      });

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      code: "BOOKING_CONFLICT",
      status: 409,
      detail: "Im gewählten Zeitraum ist bereits eine Buchung vorhanden."
    });

    const nonOverlap = await request(app)
      .post("/api/bookings/tool")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({
        toolId,
        startDate: isoDaysFromNow(40),
        endDate: isoDaysFromNow(44, 18),
        pickupTime: isoDaysFromNow(40, 14)
      });

    expect(nonOverlap.status).toBe(201);
  });

  it("creates a workshop booking and rejects a second overlapping booking with 409", async () => {
    const first = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        workshopId,
        startDate: workshopSlotStart,
        endDate: workshopSlotEnd,
        workshopToolIds: [workshopToolId]
      });

    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({
        workshopId,
        startDate: isoDaysFromNow(35, 12),
        endDate: isoDaysFromNow(35, 15),
        workshopToolIds: [workshopToolId]
      });

    expect(conflict.status).toBe(409);
    expect(conflict.body).toMatchObject({
      code: "BOOKING_CONFLICT",
      status: 409,
      detail: "Im gewählten Zeitraum ist bereits eine Buchung vorhanden."
    });
  });
});
