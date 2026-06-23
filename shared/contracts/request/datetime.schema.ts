import { z } from "zod";

/** Browser/Inputs liefern oft parsebare ISO-Strings ohne Z — normalisiert zu ISO. */
export const flexibleIsoDateTime = z
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
