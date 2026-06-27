import { beforeEach, describe, expect, it, vi } from "vitest";
import { outboxRepository } from "../src/infrastructure/outbox/outbox.repository";

const mocks = vi.hoisted(() => ({
  outboxFindMany: vi.fn(),
  outboxDeleteMany: vi.fn(),
  deliveryDeleteMany: vi.fn(),
  prismaTransaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    outboxEvent: {
      findMany: mocks.outboxFindMany,
      deleteMany: mocks.outboxDeleteMany
    },
    notificationDelivery: {
      deleteMany: mocks.deliveryDeleteMany
    },
    $transaction: mocks.prismaTransaction
  }
}));

describe("outboxRepository.prune", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prunes processed and failed outbox events and their delivery receipts", async () => {
    // Setup transaction mock
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        outboxEvent: {
          findMany: mocks.outboxFindMany,
          deleteMany: mocks.outboxDeleteMany
        },
        notificationDelivery: {
          deleteMany: mocks.deliveryDeleteMany
        }
      })
    );

    // Mock findMany to return processed outbox events that have idempotency keys
    mocks.outboxFindMany.mockResolvedValueOnce([
      { idempotencyKey: "key-1" },
      { idempotencyKey: "key-2" }
    ]);

    // Mock deleteMany calls
    mocks.deliveryDeleteMany.mockResolvedValueOnce({ count: 2 });
    mocks.outboxDeleteMany
      .mockResolvedValueOnce({ count: 2 }) // First call for processed
      .mockResolvedValueOnce({ count: 1 }); // Second call for failed

    const olderThan = new Date("2026-06-20T10:00:00.000Z");
    const result = await outboxRepository.prune(olderThan);

    // Verify findMany was called with the date
    expect(mocks.outboxFindMany).toHaveBeenCalledWith({
      where: {
        processedAt: {
          lt: olderThan
        }
      },
      select: { idempotencyKey: true }
    });

    // Verify NotificationDelivery deleteMany was called with the keys
    expect(mocks.deliveryDeleteMany).toHaveBeenCalledWith({
      where: {
        idempotencyKey: {
          in: ["key-1", "key-2"]
        }
      }
    });

    // Verify OutboxEvent deleteMany was called for processed
    expect(mocks.outboxDeleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        processedAt: {
          lt: olderThan
        }
      }
    });

    // Verify OutboxEvent deleteMany was called for failed
    expect(mocks.outboxDeleteMany).toHaveBeenNthCalledWith(2, {
      where: {
        processedAt: null,
        retryCount: { gte: 5 },
        createdAt: { lt: expect.any(Date) }
      }
    });

    expect(result).toEqual({
      deletedProcessed: 2,
      deletedFailed: 1
    });
  });

  it("does not delete delivery receipts when no processed events are found", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        outboxEvent: {
          findMany: mocks.outboxFindMany,
          deleteMany: mocks.outboxDeleteMany
        },
        notificationDelivery: {
          deleteMany: mocks.deliveryDeleteMany
        }
      })
    );

    mocks.outboxFindMany.mockResolvedValueOnce([]);
    mocks.outboxDeleteMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    const olderThan = new Date("2026-06-20T10:00:00.000Z");
    const result = await outboxRepository.prune(olderThan);

    expect(mocks.deliveryDeleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedProcessed: 0,
      deletedFailed: 0
    });
  });
});
