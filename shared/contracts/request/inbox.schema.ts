import { z } from "zod";

// Begrenzt die Batch-Größe pro POST (Seeding schickt alle vorhandenen Keys auf
// einmal; ein großzügiges Limit deckt auch sehr aktive Nutzer ab).
export const addInboxReadReceiptsSchema = z.object({
  body: z.object({
    messageKeys: z.array(z.string().min(1).max(200)).max(5000)
  }),
  params: z.object({}),
  query: z.object({})
});
