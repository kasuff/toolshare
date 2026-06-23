import { z } from "zod";
import {
  createPickupProposalBodySchema,
  createTimeslotProposalBodySchema,
  createToolBookingBodySchema,
  createToolOwnerBlockBodySchema,
  createWorkshopBookingBodySchema,
  respondPickupProposalBodySchema,
  respondTimeslotProposalBodySchema,
  updateBookingStatusBodySchema
} from "@toolshare/shared/contracts/request/bookings.schema";

export const createToolBookingSchema = z.object({
  body: createToolBookingBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const createToolOwnerBlockSchema = z.object({
  body: createToolOwnerBlockBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const createWorkshopBookingSchema = z.object({
  body: createWorkshopBookingBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateBookingStatusSchema = z.object({
  body: updateBookingStatusBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createPickupProposalSchema = z.object({
  body: createPickupProposalBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const respondPickupProposalSchema = z.object({
  body: respondPickupProposalBodySchema,
  params: z.object({
    id: z.string().uuid(),
    proposalId: z.string().uuid()
  }),
  query: z.object({})
});

export const createTimeslotProposalSchema = z.object({
  body: createTimeslotProposalBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const respondTimeslotProposalSchema = z.object({
  body: respondTimeslotProposalBodySchema,
  params: z.object({
    id: z.string().uuid(),
    proposalId: z.string().uuid()
  }),
  query: z.object({})
});
