import { describe, expect, it } from "vitest";
import {
  workshopResponseSchema,
  workshopTimeslotResponseSchema
} from "@toolshare/shared/contracts/response/workshops.schema";
import {
  toWorkshopResponse,
  toWorkshopTimeslotResponse
} from "../../src/modules/workshops/workshops.presenter";
import type { WorkshopEntity, WorkshopTimeslotEntity } from "../../src/modules/workshops/workshops.entity";

const sampleWorkshop: WorkshopEntity = {
  id: "11111111-1111-1111-1111-111111111111",
  managerId: "22222222-2222-2222-2222-222222222222",
  manager: { id: "22222222-2222-2222-2222-222222222222", name: "Max", isSuspended: false },
  name: "Holzwerkstatt",
  description: "Voll ausgestattet",
  location: "Halle 1",
  maxCapacity: 8,
  equipment: ["Hobel", "Säge"],
  imageUrls: ["https://example.com/a.jpg"],
  workshopTools: [{ id: "33333333-3333-3333-3333-333333333333", name: "Drechselbank", category: "Holz" }],
  timeslots: [
    {
      id: "44444444-4444-4444-4444-444444444444",
      workshopId: "11111111-1111-1111-1111-111111111111",
      startTime: new Date("2026-07-01T10:00:00.000Z"),
      endTime: new Date("2026-07-01T12:00:00.000Z"),
      blockedByOwner: false
    }
  ],
  bookings: [
    {
      id: "55555555-5555-5555-5555-555555555555",
      startDate: new Date("2026-07-02T10:00:00.000Z"),
      endDate: new Date("2026-07-02T12:00:00.000Z"),
      status: "ACCEPTED"
    }
  ]
};

const sampleTimeslot: WorkshopTimeslotEntity = {
  id: "44444444-4444-4444-4444-444444444444",
  workshopId: "11111111-1111-1111-1111-111111111111",
  startTime: new Date("2026-07-01T10:00:00.000Z"),
  endTime: new Date("2026-07-01T12:00:00.000Z"),
  blockedByOwner: true
};

describe("workshops contracts", () => {
  it("workshop presenter output matches workshopResponseSchema", () => {
    const response = toWorkshopResponse(sampleWorkshop);
    expect(() => workshopResponseSchema.parse(response)).not.toThrow();
  });

  it("normalizes the prisma equipment column to the extras wire field", () => {
    const response = toWorkshopResponse(sampleWorkshop);
    expect(response.extras).toEqual(["Hobel", "Säge"]);
    expect(response).not.toHaveProperty("equipment");
  });

  it("timeslot presenter output matches workshopTimeslotResponseSchema", () => {
    const response = toWorkshopTimeslotResponse(sampleTimeslot);
    expect(() => workshopTimeslotResponseSchema.parse(response)).not.toThrow();
    expect(response.startTime).toBe("2026-07-01T10:00:00.000Z");
  });
});
