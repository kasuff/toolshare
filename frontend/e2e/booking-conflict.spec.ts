import { test, expect, request as apiRequest } from "@playwright/test";
import { createToolBooking, registerUser } from "./fixtures/api";
import { isoDaysFromNow, makeUser } from "./fixtures/data";
import { readUsers } from "./fixtures/roles";
import { seedTool } from "./fixtures/booking";

/**
 * Überlappende Doppelbuchung: die zweite Anfrage auf denselben Zeitraum erhält 409.
 * (Echter Parallel-Race ist in den DB-Integrationstests abgedeckt.)
 */
test.describe("Ausleihe – Doppelbuchung", () => {
  test("zweite überlappende Anfrage erhält BOOKING_CONFLICT", async () => {
    const tool = await seedTool("E2E Parallel");
    const users = readUsers();
    const api = await apiRequest.newContext();
    const secondUser = makeUser("anfrager-parallel");
    const secondAuth = await registerUser(api, secondUser);

    const payload = {
      toolId: tool.id,
      startDate: isoDaysFromNow(12),
      endDate: isoDaysFromNow(16, 18),
      pickupTime: isoDaysFromNow(12, 14),
    };

    const first = await createToolBooking(api, users.anfrager.token, payload);
    expect(first.status).toBe(201);

    const second = await createToolBooking(api, secondAuth.accessToken, payload);
    await api.dispose();

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({
      code: "BOOKING_CONFLICT",
      status: 409,
    });
  });
});
