import { z } from "zod";
import {
  changePasswordBodySchema,
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema
} from "@toolshare/shared/contracts/request/auth.schema";

export const registerSchema = z.object({
  body: registerBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const loginSchema = z.object({
  body: loginBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const refreshSchema = z.object({
  body: refreshBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const changePasswordSchema = z.object({
  body: changePasswordBodySchema,
  params: z.object({}),
  query: z.object({})
});
