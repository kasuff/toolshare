import type { Prisma } from "@prisma/client";
import {
  USER_NOTIFICATION_REQUESTED,
  buildNotificationIdempotencyKey,
  type UserNotificationPayload
} from "../../domain/events/notification.events";
import { outboxRepository } from "./outbox.repository";

export type ScheduleUserNotificationInput = UserNotificationPayload & {
  idempotencyKey: string;
  aggregateType?: string;
  aggregateId?: string;
};

export const notificationOutboxService = {
  scheduleUserNotification(tx: Prisma.TransactionClient, input: ScheduleUserNotificationInput) {
    return outboxRepository.enqueue(tx, {
      eventType: USER_NOTIFICATION_REQUESTED,
      payload: {
        userId: input.userId,
        inAppMessage: input.inAppMessage,
        pushTitle: input.pushTitle,
        pushBody: input.pushBody
      },
      idempotencyKey: input.idempotencyKey,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId
    });
  },

  scheduleToolBookingRequestNotification(
    tx: Prisma.TransactionClient,
    input: { bookingId: string; ownerId: string }
  ) {
    const message = "Neue Ausleihanfrage für dein Werkzeug.";
    return notificationOutboxService.scheduleUserNotification(tx, {
      userId: input.ownerId,
      inAppMessage: message,
      pushTitle: "Neue Anfrage",
      pushBody: message,
      idempotencyKey: buildNotificationIdempotencyKey(
        "booking",
        input.bookingId,
        "tool-request",
        input.ownerId
      ),
      aggregateType: "booking",
      aggregateId: input.bookingId
    });
  },

  scheduleWorkshopBookingRequestNotification(
    tx: Prisma.TransactionClient,
    input: { bookingId: string; providerId: string }
  ) {
    const message = "Neue Buchungsanfrage für deine Werkstatt.";
    return notificationOutboxService.scheduleUserNotification(tx, {
      userId: input.providerId,
      inAppMessage: message,
      pushTitle: "Neue Anfrage",
      pushBody: message,
      idempotencyKey: buildNotificationIdempotencyKey(
        "booking",
        input.bookingId,
        "workshop-request",
        input.providerId
      ),
      aggregateType: "booking",
      aggregateId: input.bookingId
    });
  },

  scheduleBookingStatusNotification(
    tx: Prisma.TransactionClient,
    input: { bookingId: string; userId: string; status: string }
  ) {
    const inAppMessage = `Deine Buchung wurde auf ${input.status} gesetzt.`;
    return notificationOutboxService.scheduleUserNotification(tx, {
      userId: input.userId,
      inAppMessage,
      pushTitle: "Buchungs-Update",
      pushBody: inAppMessage,
      idempotencyKey: buildNotificationIdempotencyKey(
        "booking",
        input.bookingId,
        "status",
        input.status,
        input.userId
      ),
      aggregateType: "booking",
      aggregateId: input.bookingId
    });
  },

  scheduleProposalNotification(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      userId: string;
      kind: "pickup-created" | "pickup-declined" | "pickup-accepted" | "timeslot-created" | "timeslot-declined" | "timeslot-accepted";
      inAppMessage: string;
      pushTitle: string;
      pushBody: string;
    }
  ) {
    return notificationOutboxService.scheduleUserNotification(tx, {
      userId: input.userId,
      inAppMessage: input.inAppMessage,
      pushTitle: input.pushTitle,
      pushBody: input.pushBody,
      idempotencyKey: buildNotificationIdempotencyKey(
        "booking",
        input.bookingId,
        input.kind,
        input.userId
      ),
      aggregateType: "booking",
      aggregateId: input.bookingId
    });
  },

  scheduleRatingNotification(
    tx: Prisma.TransactionClient,
    input: { ratingId: string; providerId: string; starsLabel: string }
  ) {
    const inAppMessage = `Du hast eine neue Bewertung erhalten (${input.starsLabel}).`;
    return notificationOutboxService.scheduleUserNotification(tx, {
      userId: input.providerId,
      inAppMessage,
      pushTitle: "Neue Bewertung",
      pushBody: inAppMessage,
      idempotencyKey: buildNotificationIdempotencyKey("rating", input.ratingId, input.providerId),
      aggregateType: "rating",
      aggregateId: input.ratingId
    });
  },

  scheduleModerationNotification(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      idempotencyKey: string;
      inAppMessage: string;
      pushTitle: string;
      pushBody: string;
      aggregateType?: string;
      aggregateId?: string;
    }
  ) {
    return notificationOutboxService.scheduleUserNotification(tx, input);
  }
};