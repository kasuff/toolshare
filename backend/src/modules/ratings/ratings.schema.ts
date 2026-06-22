import { z } from "zod";
import { createRatingBodySchema } from "@toolshare/shared/contracts/request/ratings.schema";

export const createRatingSchema = z.object({
  body: createRatingBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const ratingsForUserSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const ratingsForToolSchema = z.object({
  body: z.object({}),
  params: z.object({
    toolId: z.string().uuid()
  }),
  query: z.object({})
});

export const ratingsForWorkshopSchema = z.object({
  body: z.object({}),
  params: z.object({
    workshopId: z.string().uuid()
  }),
  query: z.object({})
});
