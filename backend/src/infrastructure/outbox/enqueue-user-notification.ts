import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma";
import { buildNotificationIdempotencyKey } from "../../domain/events/notification.events";
import { notificationOutboxService } from "./notification-outbox.service";

type ProposalNotificationInput = {
  bookingId: string;
  userId: string;
  kind:
    | "pickup-created"
    | "pickup-declined"
    | "pickup-accepted"
    | "timeslot-created"
    | "timeslot-declined"
    | "timeslot-accepted";
  inAppMessage: string;
  pushTitle: string;
  pushBody: string;
};

export async function enqueueProposalNotification(input: ProposalNotificationInput) {
  await prisma.$transaction(async (tx) => {
    await notificationOutboxService.scheduleProposalNotification(tx, input);
  });
}

export async function enqueueModerationNotification(input: {
  userId: string;
  inAppMessage: string;
  pushTitle?: string;
  pushBody?: string;
  idempotencyKey: string;
  aggregateType?: string;
  aggregateId?: string;
}) {
  await prisma.$transaction(async (tx) => {
    await notificationOutboxService.scheduleModerationNotification(tx, {
      ...input,
      pushTitle: input.pushTitle ?? "ToolShare",
      pushBody: input.pushBody ?? input.inAppMessage
    });
  });
}

export async function enqueueBookingCancellationNotification(input: {
  bookingId: string;
  userId: string;
  inAppMessage: string;
}) {
  await prisma.$transaction(async (tx) => {
    await notificationOutboxService.scheduleUserNotification(tx, {
      userId: input.userId,
      inAppMessage: input.inAppMessage,
      pushTitle: "Buchung storniert",
      pushBody: input.inAppMessage,
      idempotencyKey: buildNotificationIdempotencyKey(
        "booking",
        input.bookingId,
        "cancelled",
        input.userId
      ),
      aggregateType: "booking",
      aggregateId: input.bookingId
    });
  });
}

export function newModerationNotificationKey(prefix: string) {
  return buildNotificationIdempotencyKey("moderation", prefix, randomUUID());
}
