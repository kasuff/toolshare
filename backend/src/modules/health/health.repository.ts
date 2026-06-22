import { prisma } from "../../config/prisma";

export type HealthCheckStatus = "ok" | "fail";

export type ReadinessReport = {
  ready: boolean;
  checks: {
    database: HealthCheckStatus;
  };
  outbox: {
    pending: number;
    deadLetter: number;
  };
};

export const healthRepository = {
  async getReadiness(): Promise<ReadinessReport> {
    const checks: ReadinessReport["checks"] = { database: "fail" };
    let pending = 0;
    let deadLetter = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "fail";
    }

    try {
      [pending, deadLetter] = await Promise.all([
        prisma.outboxEvent.count({
          where: { processedAt: null, retryCount: { lt: 5 } }
        }),
        prisma.outboxEvent.count({
          where: { processedAt: null, retryCount: { gte: 5 } }
        })
      ]);
    } catch {
      // Outbox-Tabelle fehlt (Migration noch nicht gelaufen) — Readiness nur über DB.
    }

    return {
      ready: checks.database === "ok",
      checks,
      outbox: { pending, deadLetter }
    };
  }
};
