import { inboxRepository } from "./inbox.repository";

export const inboxService = {
  listReadReceipts(userId: string): Promise<string[]> {
    return inboxRepository.listKeys(userId);
  },

  addReadReceipts(userId: string, messageKeys: string[]): Promise<void> {
    return inboxRepository.addKeys(userId, messageKeys);
  }
};
