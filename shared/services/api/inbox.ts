import { request, requestParsed } from "./client";
import { inboxReadReceiptsResponseSchema } from "../../contracts/response/inbox.schema";

// Server-seitiger Read-Status der Inbox (Pendant zum früheren localStorage/SecureStore).
// Die synthetischen Message-Keys werden weiterhin clientseitig berechnet
// (shared/utils/inboxMessageRead.ts) und hier nur persistiert/geladen.
export const inboxApi = {
  async getInboxReadReceipts(token: string): Promise<string[]> {
    const { messageKeys } = await requestParsed(
      inboxReadReceiptsResponseSchema,
      "/inbox/read-receipts",
      undefined,
      token
    );
    return messageKeys;
  },

  async addInboxReadReceipts(messageKeys: string[], token: string): Promise<void> {
    if (messageKeys.length === 0) return;
    await request(
      "/inbox/read-receipts",
      { method: "POST", body: JSON.stringify({ messageKeys }) },
      token
    );
  }
};
