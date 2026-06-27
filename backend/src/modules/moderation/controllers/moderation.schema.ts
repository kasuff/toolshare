import { z } from "zod";
import {
  createReportBodySchema,
  updateReportBodySchema
} from "@toolshare/shared/contracts/request/moderation.schema";

export const createReportSchema = z.object({
  body: createReportBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateReportSchema = z.object({
  body: updateReportBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});