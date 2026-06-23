import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type OutboxEnqueueInput = {
  eventType: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey: string;
  aggregateType?: string;
  aggregateId?: string;
};

export const outboxRepository = {
  enqueue(tx: Prisma.TransactionClient, input: OutboxEnqueueInput) {
    return tx.outboxEvent.create({
      data: {
        eventType: input.eventType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId
      }
    });
  },

  async claimPending(limit: number) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          eventType: string;
          payload: unknown;
          idempotencyKey: string;
          retryCount: number;
        }>
      >`
        SELECT id, "eventType", payload, "idempotencyKey", "retryCount"
        FROM "OutboxEvent"
        WHERE "processedAt" IS NULL AND "retryCount" < 5
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;
      return rows;
    });
  },

  markProcessed(id: string) {
    return prisma.outboxEvent.update({
      where: { id },
      data: { processedAt: new Date(), lastError: null }
    });
  },

  markFailed(id: string, error: string) {
    return prisma.outboxEvent.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        lastError: error.slice(0, 500)
      }
    });
  },

  hasDelivered(idempotencyKey: string) {
    return prisma.notificationDelivery.findUnique({
      where: { idempotencyKey },
      select: { idempotencyKey: true }
    });
  },

  recordDelivery(idempotencyKey: string) {
    return prisma.notificationDelivery.upsert({
      where: { idempotencyKey },
      create: { idempotencyKey },
      update: {}
    });
  }
};
