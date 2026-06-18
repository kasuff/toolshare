import { z } from "zod";

const roleSchema = z.enum(["USER", "MODERATOR", "MANAGER"]);

export const listUsersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    role: roleSchema.optional(),
    search: z.string().min(1).optional()
  })
});

export const userIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

const hasHouseNumber = (val: string) => {
  const streetPart = val.split(",")[0]?.trim() ?? "";
  const tokens = streetPart.split(/\s+/).filter(Boolean);
  const lastToken = tokens.length > 1 ? tokens.pop() : "";
  return Boolean(lastToken && /\d/.test(lastToken));
};

export const updateMyProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      address: z.string().min(5).refine(hasHouseNumber, {
        message: "Die Adresse muss eine Hausnummer enthalten."
      }).optional()
    })
    .refine((value) => value.name !== undefined || value.address !== undefined, {
      message: "Mindestens ein Feld muss angegeben werden."
    }),
  params: z.object({}),
  query: z.object({})
});

export const updateUserRoleSchema = z.object({
  body: z.object({
    role: roleSchema
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const updateUserSuspensionSchema = z.object({
  body: z.object({
    isSuspended: z.boolean()
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const decideSuspensionRequestSchema = z.object({
  body: z.object({
    approve: z.boolean(),
    decisionNote: z.string().min(3).max(600).optional()
  }),
  params: z.object({
    requestId: z.string().uuid()
  }),
  query: z.object({})
});
