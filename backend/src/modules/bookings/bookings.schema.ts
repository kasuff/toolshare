import { z } from "zod";
import { createToolBookingBodySchema } from "@toolshare/shared/contracts/request/bookings.schema";
import { flexibleIsoDateTime } from "@toolshare/shared/contracts/request/datetime.schema";

export const createToolBookingSchema = z.object({
  body: createToolBookingBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const createToolOwnerBlockSchema = z.object({
  body: z.object({
    toolId: z.string().uuid(),
    startDate: flexibleIsoDateTime,
    endDate: flexibleIsoDateTime
  }),
  params: z.object({}),
  query: z.object({})
});

export const createWorkshopBookingSchema = z.object({
  body: z.object({
    workshopId: z.string().uuid(),
    startDate: flexibleIsoDateTime,
    endDate: flexibleIsoDateTime,
    workshopToolIds: z.array(z.string().uuid()).optional().default([])
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(["ACCEPTED", "REJECTED", "RETURNED"])
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createPickupProposalSchema = z.object({
  body: z.object({
    pickupTime: flexibleIsoDateTime,
    returnTime: flexibleIsoDateTime
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const respondPickupProposalSchema = z.object({
  body: z.object({
    decision: z.enum(["ACCEPT", "DECLINE"])
  }),
  params: z.object({
    id: z.string().uuid(),
    proposalId: z.string().uuid()
  }),
  query: z.object({})
});

export const createTimeslotProposalSchema = z.object({
  body: z.object({
    startDate: flexibleIsoDateTime,
    endDate: flexibleIsoDateTime
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const respondTimeslotProposalSchema = z.object({
  body: z.object({
    decision: z.enum(["ACCEPT", "DECLINE"])
  }),
  params: z.object({
    id: z.string().uuid(),
    proposalId: z.string().uuid()
  }),
  query: z.object({})
});
