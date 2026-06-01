import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import type { Express } from "express";

const app = createApp() as Express;

async function registerAndLogin(email: string, password: string, name: string) {
  await request(app).post("/api/auth/register").send({
    email,
    password,
    name,
    address: "Test Street 1"
  });
  const login = await request(app).post("/api/auth/login").send({ email, password });
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
  let timeslotId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "test-secret";

    ownerToken = await registerAndLogin(ownerEmail, password, "Owner");
    requesterToken = await registerAndLogin(requesterEmail, password, "Requester");
    secondRequesterToken = await registerAndLogin(
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
        category: "elektro"
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
        maxCapacity: 4
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
    timeslotId = slotResponse.body.id as string;
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

  it("creates a workshop booking and rejects a second booking for the same slot with 409", async () => {
    const first = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ timeslotId });

    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post("/api/bookings/workshop")
      .set("Authorization", `Bearer ${secondRequesterToken}`)
      .send({ timeslotId });

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
