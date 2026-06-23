import { z } from "zod";

export const roleSchema = z.enum(["USER", "MODERATOR", "MANAGER"]);

export const listUsersQuerySchema = z.object({
  role: roleSchema.optional(),
  search: z.string().min(1).optional()
});

const hasHouseNumber = (val: string) => {
  const streetPart = val.split(",")[0]?.trim() ?? "";
  const tokens = streetPart.split(/\s+/).filter(Boolean);
  const lastToken = tokens.length > 1 ? tokens.pop() : "";
  return Boolean(lastToken && /\d/.test(lastToken));
};

export const updateMyProfileBodySchema = z
  .object({
    name: z.string().min(2).optional(),
    address: z.string().min(5).refine(hasHouseNumber, {
      message: "Die Adresse muss eine Hausnummer enthalten."
    }).optional(),
    expoPushToken: z.string().optional()
  })
  .refine((value) => value.name !== undefined || value.address !== undefined || value.expoPushToken !== undefined, {
    message: "Mindestens ein Feld muss angegeben werden."
  });

export const updateUserRoleBodySchema = z.object({
  role: roleSchema
});

export const updateUserSuspensionBodySchema = z.object({
  isSuspended: z.boolean()
});

export const decideSuspensionRequestBodySchema = z.object({
  approve: z.boolean(),
  decisionNote: z.string().min(3).max(600).optional()
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateMyProfileBody = z.infer<typeof updateMyProfileBodySchema>;
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleBodySchema>;
export type UpdateUserSuspensionBody = z.infer<typeof updateUserSuspensionBodySchema>;
export type DecideSuspensionRequestBody = z.infer<typeof decideSuspensionRequestBodySchema>;
