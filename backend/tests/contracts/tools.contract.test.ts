import { describe, expect, it } from "vitest";
import { toolResponseSchema } from "../../../shared/contracts/response/tools.schema";
import { problemDetailsSchema } from "../../../shared/contracts/errors/problem.schema";
import { toToolResponse } from "../../src/modules/tools/controllers/tools.presenter";
import type { ToolEntity } from "../../src/modules/tools/entities/tools.entity";

const sampleTool: ToolEntity = {
  id: "11111111-1111-1111-1111-111111111111",
  ownerId: "22222222-2222-2222-2222-222222222222",
  name: "Bohrer",
  description: "Leistungsstarker Bohrer",
  category: "Elektro",
  imageUrl: "data:image/png;base64,abc",
  pickupLocation: "Leopoldstraße 1, 80802 München, Deutschland",
  pickupLocationNote: null,
  status: "AVAILABLE",
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-02T10:00:00.000Z"),
  owner: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Max",
    role: "USER",
    isSuspended: false
  },
  bookings: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      startDate: new Date("2026-02-01T10:00:00.000Z"),
      endDate: new Date("2026-02-02T10:00:00.000Z"),
      status: "ACCEPTED"
    }
  ]
};

describe("API contracts", () => {
  it("tool presenter output matches ToolResponseSchema", () => {
    const response = toToolResponse(sampleTool);
    expect(() => toolResponseSchema.parse(response)).not.toThrow();
  });

  it("RFC 7807 problem details schema accepts backend error shape", () => {
    const problem = {
      type: "urn:toolshare:problem:validation-error",
      title: "VALIDATION ERROR",
      status: 400,
      detail: "Die Eingabedaten sind ungültig.",
      code: "VALIDATION_ERROR",
      errors: {
        fieldErrors: {
          body: ["String must contain at least 8 character(s)"]
        },
        formErrors: []
      }
    };
    expect(() => problemDetailsSchema.parse(problem)).not.toThrow();
  });
});