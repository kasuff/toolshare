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

export const updateMyProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      address: z.string().min(5).optional(),
      avatarUrl: z.string().url().nullable().optional()
    })
    .refine((value) => value.name !== undefined || value.address !== undefined || value.avatarUrl !== undefined, {
      message: "At least one field must be provided"
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
