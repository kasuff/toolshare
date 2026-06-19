import { describe, expect, it } from "vitest";
import { registerSchema } from "../src/modules/auth/auth.schema";
import { updateMyProfileSchema } from "../src/modules/users/users.schema";

describe("Schema Validation - Hausnummer Prüfung", () => {
  describe("registerSchema", () => {
    const basePayload = {
      email: "test@example.com",
      password: "password123!",
      name: "Max Mustermann"
    };

    it("should pass for valid addresses with house numbers", () => {
      const validAddresses = [
        "Musterstraße 5",
        "Musterstraße 5a",
        "Hauptstraße 123, 80333 München",
        "Am Althof 14b",
        "Schloßweg 12-14, Berlin",
        "Lothstraße 64, 80335 München"
      ];

      for (const address of validAddresses) {
        const result = registerSchema.safeParse({
          body: { ...basePayload, address },
          params: {},
          query: {}
        });
        expect(result.success, `Expected success for: ${address}`).toBe(true);
      }
    });

    it("should fail for addresses missing a house number", () => {
      const invalidAddresses = [
        "Musterstraße",
        "Musterstraße, 80333 München",
        "Hauptstraße, München",
        "Schloßweg, Berlin, Deutschland",
        "Lothstraße"
      ];

      for (const address of invalidAddresses) {
        const result = registerSchema.safeParse({
          body: { ...basePayload, address },
          params: {},
          query: {}
        });
        expect(result.success, `Expected failure for: ${address}`).toBe(false);
        if (!result.success) {
          const fieldErrors = result.error.flatten().fieldErrors;
          expect(fieldErrors.body?.[0]).toContain("Hausnummer");
        }
      }
    });
  });

  describe("updateMyProfileSchema", () => {
    it("should pass when name and address are omitted", () => {
      const result = updateMyProfileSchema.safeParse({
        body: { name: "New Name" }, // only name
        params: {},
        query: {}
      });
      expect(result.success).toBe(true);
    });

    it("should pass with a valid address and no name", () => {
      const result = updateMyProfileSchema.safeParse({
        body: { address: "Musterstraße 5" },
        params: {},
        query: {}
      });
      expect(result.success).toBe(true);
    });

    it("should fail with an invalid address without a house number", () => {
      const result = updateMyProfileSchema.safeParse({
        body: { address: "Musterstraße" },
        params: {},
        query: {}
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.body?.[0]).toContain("Hausnummer");
      }
    });
  });
});
