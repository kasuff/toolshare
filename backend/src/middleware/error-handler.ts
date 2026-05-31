import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";

const userFriendlyMessageByCode: Record<string, string> = {
  UNAUTHORIZED: "Ihre Anmeldung ist abgelaufen oder ungueltig. Bitte melden Sie sich erneut an.",
  FORBIDDEN: "Sie haben keine Berechtigung fuer diese Aktion.",
  INVALID_CREDENTIALS: "E-Mail oder Passwort ist nicht korrekt.",
  EMAIL_ALREADY_EXISTS: "Diese E-Mail-Adresse ist bereits registriert.",
  USER_NOT_FOUND: "Der Benutzer wurde nicht gefunden.",
  TOOL_NOT_FOUND: "Das Werkzeug wurde nicht gefunden.",
  WORKSHOP_NOT_FOUND: "Der Workshop wurde nicht gefunden.",
  TIMESLOT_NOT_FOUND: "Der Zeitslot wurde nicht gefunden.",
  BOOKING_NOT_FOUND: "Die Buchung wurde nicht gefunden.",
  BOOKING_CONFLICT: "Im gewaehlten Zeitraum ist bereits eine Buchung vorhanden.",
  TIMESLOT_BLOCKED: "Der Zeitslot ist vom Anbieter blockiert.",
  TIMESLOT_CONFLICT: "Der Zeitslot ueberschneidet sich mit einem bestehenden Termin.",
  INVALID_TIME_RANGE: "Der angegebene Zeitraum ist ungueltig.",
  WORKSHOP_TOOLS_REQUIRED: "Bitte waehlen Sie mindestens ein Werkzeug fuer die Werkstattbuchung aus.",
  WORKSHOP_TOOLS_INVALID: "Die ausgewaehlten Werkzeuge sind fuer diese Werkstattbuchung ungueltig.",
  WORKSHOP_TOOLS_UNAVAILABLE: "Mindestens ein ausgewaehltes Werkzeug ist aktuell nicht auswaehlbar.",
  WORKSHOP_TIMESLOT_INVALID: "Der gewaehlte Zeitraum muss vollstaendig innerhalb einer verfuegbaren Werkstattzeit liegen.",
  PROPOSAL_NOT_FOUND: "Der Alternativvorschlag wurde nicht gefunden.",
  INVALID_STATE: "Diese Aktion ist im aktuellen Status nicht moeglich.",
  ACTIVE_BOOKING_EXISTS: "Das Werkzeug kann nicht geloescht werden, weil noch aktive Buchungen existieren.",
  REPORT_NOT_FOUND: "Die Meldung wurde nicht gefunden.",
  INVALID_RATING_TARGET: "Sie koennen sich nicht selbst bewerten.",
  RATING_ALREADY_EXISTS: "Fuer diese Buchung wurde bereits eine Bewertung abgegeben.",
  NOTIFICATION_NOT_FOUND: "Die Benachrichtigung wurde nicht gefunden.",
  ACCOUNT_BLOCKED: "Dieses Konto ist gesperrt."
};

const userFriendlyMessageByLegacyMessage: Record<string, string> = {
  "Missing bearer token": "Bitte melden Sie sich an, um fortzufahren.",
  "Invalid or expired token": "Ihre Anmeldung ist abgelaufen oder ungueltig. Bitte melden Sie sich erneut an.",
  "Malformed token payload": "Ihre Anmeldung ist ungueltig. Bitte melden Sie sich erneut an.",
  "Invalid refresh token": "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
};

const getMessageForAppError = (error: AppError): string => {
  if (userFriendlyMessageByCode[error.code]) {
    return userFriendlyMessageByCode[error.code];
  }

  if (userFriendlyMessageByLegacyMessage[error.message]) {
    return userFriendlyMessageByLegacyMessage[error.message];
  }

  if (error.status >= 500) {
    return "Es ist ein unerwarteter Serverfehler aufgetreten.";
  }

  return "Die Anfrage konnte nicht verarbeitet werden.";
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: getMessageForAppError(error),
        status: error.status
      }
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Die Eingabedaten sind ungueltig. Bitte pruefen Sie Ihre Angaben.",
        status: 400,
        details: error.flatten()
      }
    });
  }

  const exposeInternalDetails =
    process.env.NODE_ENV !== "production" || process.env.SHOW_INTERNAL_ERRORS === "true";

  if (exposeInternalDetails) {
    // eslint-disable-next-line no-console
    console.error("[INTERNAL_SERVER_ERROR]", error);
  }

  const internalMessage =
    exposeInternalDetails && error instanceof Error
      ? error.message
      : "Es ist ein unerwarteter Serverfehler aufgetreten.";

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: internalMessage,
      status: 500
    }
  });
};
