import { prisma } from "../../config/prisma";
import { outboxDeadLetterGauge, outboxPendingGauge } from "../../utils/metrics";

export async function refreshOutboxMetrics(): Promise<void> {
  try {
    const [pending, deadLetter] = await Promise.all([
      prisma.outboxEvent.count({
        where: { processedAt: null, retryCount: { lt: 5 } }
      }),
      prisma.outboxEvent.count({
        where: { processedAt: null, retryCount: { gte: 5 } }
      })
    ]);
    outboxPendingGauge.set(pending);
    outboxDeadLetterGauge.set(deadLetter);
  } catch {
    outboxPendingGauge.set(0);
    outboxDeadLetterGauge.set(0);
  }
}
