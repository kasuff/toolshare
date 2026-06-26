import { z } from "zod";

export const inboxReadReceiptsResponseSchema = z.object({
  messageKeys: z.array(z.string())
});

export type InboxReadReceiptsResponse = z.infer<typeof inboxReadReceiptsResponseSchema>;
