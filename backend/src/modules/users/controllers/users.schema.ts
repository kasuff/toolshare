import { z } from "zod";
import {
  decideSuspensionRequestBodySchema,
  listUsersQuerySchema,
  updateMyProfileBodySchema,
  updateUserRoleBodySchema,
  updateUserSuspensionBodySchema
} from "@toolshare/shared/contracts/request/users.schema";

export const listUsersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: listUsersQuerySchema
});

export const userIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const updateMyProfileSchema = z.object({
  body: updateMyProfileBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateUserRoleSchema = z.object({
  body: updateUserRoleBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const updateUserSuspensionSchema = z.object({
  body: updateUserSuspensionBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const decideSuspensionRequestSchema = z.object({
  body: decideSuspensionRequestBodySchema,
  params: z.object({
    requestId: z.string().uuid()
  }),
  query: z.object({})
});