import { z } from "zod";
import {
  createTimeslotBodySchema,
  createWorkshopBodySchema,
  listWorkshopsQuerySchema,
  updateTimeslotBodySchema,
  updateWorkshopBodySchema
} from "@toolshare/shared/contracts/request/workshops.schema";

export const listWorkshopsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: listWorkshopsQuerySchema
});

export const workshopIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createWorkshopSchema = z.object({
  body: createWorkshopBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateWorkshopSchema = z.object({
  body: updateWorkshopBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createTimeslotSchema = z.object({
  body: createTimeslotBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const updateTimeslotSchema = z.object({
  body: updateTimeslotBodySchema,
  params: z.object({
    id: z.string().uuid(),
    timeslotId: z.string().uuid()
  }),
  query: z.object({})
});

export const removeTimeslotSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid(),
    timeslotId: z.string().uuid()
  }),
  query: z.object({})
});