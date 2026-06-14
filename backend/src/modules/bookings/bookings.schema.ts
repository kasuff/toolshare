import { z } from "zod";

/** Zod's .datetime() ist streng (z. B. nur mit Z); Browser/Inputs liefern oft parsebare Strings ohne Offset. */
const flexibleIsoDateTime = z
  .string()
  .min(1)
  .transform((s, ctx) => {
    const d = new Date(s.trim());
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ungültiges Datum oder Uhrzeit." });
      return z.NEVER;
    }
    return d.toISOString();
  });

export const createToolBookingSchema = z.object({
  body: z.object({
    toolId: z.string().uuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    pickupTime: z.string().datetime()
  }),
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
    workshopToolIds: z.array(z.string().uuid()).min(1)
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
