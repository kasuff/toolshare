import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { AppError } from "../utils/app-error";

const userFriendlyMessageByCode: Record<string, string> = {
  UNAUTHORIZED: "Ihre Anmeldung ist abgelaufen oder ungültig. Bitte melden Sie sich erneut an.",
  FORBIDDEN: "Sie haben keine Berechtigung für diese Aktion.",
  INVALID_CREDENTIALS: "E-Mail oder Passwort ist nicht korrekt.",
  EMAIL_ALREADY_EXISTS: "Diese E-Mail-Adresse ist bereits registriert.",
  USER_NOT_FOUND: "Der Benutzer wurde nicht gefunden.",
  TOOL_NOT_FOUND: "Das Werkzeug wurde nicht gefunden.",
  WORKSHOP_NOT_FOUND: "Die Werkstatt wurde nicht gefunden.",
  TIMESLOT_NOT_FOUND: "Das Zeitfenster wurde nicht gefunden.",
  BOOKING_NOT_FOUND: "Die Buchung wurde nicht gefunden.",
  BOOKING_CONFLICT: "Im gewählten Zeitraum ist bereits eine Buchung vorhanden.",
  TIMESLOT_CONFLICT: "Das Zeitfenster überschneidet sich mit einem bestehenden Termin.",
  INVALID_TIME_RANGE: "Der angegebene Zeitraum ist ungültig.",
  ACTIVE_BOOKING_EXISTS: "Es gibt noch aktive Buchungen – diese Aktion ist nicht möglich.",
  WORKSHOP_TOOLS_REQUIRED: "Bitte wählen Sie mindestens ein Werkzeug für die Werkstattbuchung aus.",
  WORKSHOP_TOOLS_INVALID: "Die ausgewählten Werkzeuge sind für diese Werkstattbuchung ungültig.",
  WORKSHOP_TOOLS_UNAVAILABLE: "Mindestens ein ausgewähltes Werkzeug ist aktuell nicht auswählbar.",
  WORKSHOP_TIMESLOT_INVALID: "Der gewählte Zeitraum muss vollständig innerhalb einer verfügbaren Werkstattzeit liegen.",
  REPORT_NOT_FOUND: "Die Meldung wurde nicht gefunden.",
  REPORT_ALREADY_CLOSED: "Diese Meldung wurde bereits von einem anderen Moderator bearbeitet.",
  INVALID_WARNING_INPUT: "Für eine Ermahnung sind Nutzer und Begründung erforderlich.",
  INVALID_SUSPENSION_INPUT: "Für eine Sperranfrage sind Nutzer und Begründung erforderlich.",
  DECISION_NOTE_REQUIRED: "Bitte dokumentieren Sie die Entscheidung mit einer Begründung (mindestens 3 Zeichen).",
  INVALID_RATING_TARGET: "Sie können sich nicht selbst bewerten.",
  RATING_ALREADY_EXISTS: "Für diese Buchung wurde bereits eine Bewertung abgegeben.",
  RATING_NOT_ALLOWED: "Eine Bewertung ist erst nach Abschluss der Buchung möglich.",
  RATING_NOT_FOUND: "Die Bewertung wurde nicht gefunden.",
  NOTIFICATION_NOT_FOUND: "Die Benachrichtigung wurde nicht gefunden.",
  ACCOUNT_SUSPENDED: "Ihr Konto ist gesperrt.",
  ACCOUNT_BLOCKED: "Dieses Konto ist gesperrt.",
  TIMESLOT_BLOCKED: "Dieses Zeitfenster ist vom Anbieter gesperrt und nicht buchbar.",
  INVALID_STATE: "Diese Aktion ist im aktuellen Status nicht möglich.",
  BOOKING_NOT_ENDED: "Die Werkstattbuchung kann erst nach Ende des Nutzungszeitraums abgeschlossen werden.",
  INVALID_BOOKING: "Die Buchung ist unvollständig (kein Anbieter zugeordnet).",
  INVALID_PICKUP: "Die angegebene Abholzeit ist ungültig.",
  PROPOSAL_NOT_FOUND: "Der Alternativvorschlag wurde nicht gefunden.",
  NO_PICKUP: "Alternativvorschlag nur bei Ausleihanfragen mit Abholzeit möglich.",
  SUSPENSION_REQUEST_NOT_FOUND: "Die Sperranfrage wurde nicht gefunden.",
  SUSPENSION_REQUEST_ALREADY_DECIDED: "Diese Sperranfrage wurde bereits bearbeitet.",
  INVALID_ROLE_CHANGE: "Administratoren können hier nicht herabgestuft werden.",
  INVALID_ACCOUNT_SUSPENSION: "Administratoren können nicht über diese Funktion gesperrt werden.",
  VALIDATION_ERROR: "Die Eingabedaten sind ungültig. Bitte prüfen Sie Ihre Angaben."
};

const userFriendlyMessageByLegacyMessage: Record<string, string> = {
  "Missing bearer token": "Bitte melden Sie sich an, um fortzufahren.",
  "Invalid or expired token": "Ihre Anmeldung ist abgelaufen oder ungültig. Bitte melden Sie sich erneut an.",
  "Malformed token payload": "Ihre Anmeldung ist ungültig. Bitte melden Sie sich erneut an.",
  "Invalid refresh token": "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  "Insufficient role": "Sie haben keine Berechtigung für diese Aktion.",
  "Email already registered": "Diese E-Mail-Adresse ist bereits registriert.",
  "Invalid credentials": "E-Mail oder Passwort ist nicht korrekt.",
  "Report not found": "Die Meldung wurde nicht gefunden.",
  "Report is already closed": "Diese Meldung wurde bereits bearbeitet.",
  "Notification not found": "Die Benachrichtigung wurde nicht gefunden.",
  "Suspension request not found": "Die Sperranfrage wurde nicht gefunden.",
  "Suspension request is already decided": "Diese Sperranfrage wurde bereits bearbeitet.",
  "Tool not found": "Das Werkzeug wurde nicht gefunden.",
  "Workshop not found": "Die Werkstatt wurde nicht gefunden.",
  "Timeslot not found": "Das Zeitfenster wurde nicht gefunden.",
  "Booking not found": "Die Buchung wurde nicht gefunden.",
  "Only owner or moderation roles can update this tool":
    "Nur der Besitzer oder die Moderation darf dieses Werkzeug bearbeiten.",
  "Only owner or moderation roles can delete this tool":
    "Nur der Besitzer oder die Moderation darf dieses Werkzeug löschen.",
  "Tool has active bookings and cannot be deleted":
    "Das Werkzeug kann nicht gelöscht werden, weil noch aktive Buchungen existieren.",
  "Invalid booking time range": "Der Buchungszeitraum ist ungültig.",
  "Resource is unavailable in the selected period":
    "Im gewählten Zeitraum ist die Ressource nicht verfügbar.",
  "Timeslot is blocked by workshop owner": "Dieses Zeitfenster ist vom Anbieter gesperrt.",
  "Only booking participants can complete a booking":
    "Nur Beteiligte der Buchung können sie abschließen.",
  "Only provider or moderation roles can update booking":
    "Nur Anbieter oder Moderation dürfen den Buchungsstatus ändern.",
  "Booking is not open for negotiation": "Für diese Buchung sind keine Verhandlungen mehr möglich.",
  "Booking has no provider": "Die Buchung hat keinen zugeordneten Anbieter.",
  "Not a participant": "Sie sind nicht an dieser Buchung beteiligt.",
  "Invalid pickup time": "Die Abholzeit ist ungültig.",
  "Proposal not found": "Der Alternativvorschlag wurde nicht gefunden.",
  "Proposal is no longer pending": "Der Alternativvorschlag wurde bereits bearbeitet.",
  "Cannot respond to own proposal": "Sie können nicht auf Ihren eigenen Vorschlag antworten.",
  "Only the workshop manager can update this workshop":
    "Nur der Werkstatt-Anbieter darf diese Werkstatt bearbeiten.",
  "Only the workshop manager can delete this workshop":
    "Nur der Werkstatt-Anbieter darf diese Werkstatt löschen.",
  "Only the workshop manager can manage timeslots":
    "Nur der Werkstatt-Anbieter darf Zeitfenster verwalten.",
  "Invalid timeslot range": "Der Zeitraum des Zeitfensters ist ungültig.",
  "Blocked timeslot overlaps with an existing blocked slot":
    "Das Sperrzeitfenster überschneidet sich mit einem bestehenden Sperrblock.",
  "Affected timeslot has active bookings and cannot be blocked":
    "Das Zeitfenster hat aktive Buchungen und kann nicht gesperrt werden.",
  "Timeslot overlaps with an existing slot":
    "Das Zeitfenster überschneidet sich mit einem bestehenden Termin.",
  "Only the workshop manager can update timeslots":
    "Nur der Werkstatt-Anbieter darf Zeitfenster bearbeiten.",
  "Timeslot has active bookings and cannot change time range":
    "Das Zeitfenster hat aktive Buchungen – der Zeitraum kann nicht geändert werden.",
  "Only the workshop manager can remove timeslots":
    "Nur der Werkstatt-Anbieter darf Zeitfenster entfernen.",
  "Timeslot has active bookings and cannot be removed":
    "Das Zeitfenster hat aktive Buchungen und kann nicht entfernt werden.",
  "Managers cannot be downgraded through this endpoint":
    "Administratoren können hier nicht herabgestuft werden.",
  "Managers cannot be suspended through this endpoint":
    "Administratoren können nicht über diese Funktion gesperrt werden.",
  "Users cannot rate themselves": "Sie können sich nicht selbst bewerten.",
  "Ratings are only allowed between booking participants":
    "Bewertungen sind nur zwischen Buchungsteilnehmern möglich.",
  "Rating is only allowed after the booking period has finished":
    "Eine Bewertung ist erst nach Abschluss der Buchung möglich.",
  "Rating already exists for this booking pair":
    "Für diese Buchung wurde bereits eine Bewertung abgegeben.",
  "warnUserId and warningReason must be provided together":
    "Für eine Ermahnung sind Nutzer und Begründung erforderlich.",
  "requestSuspensionUserId and suspensionReason must be provided together":
    "Für eine Sperranfrage sind Nutzer und Begründung erforderlich.",
  "decisionNote is required when rejecting a report":
    "Bitte geben Sie eine Begründung zum Verwerfen der Meldung an.",
  "decisionNote is required when resolving without warning or suspension request":
    "Bitte dokumentieren Sie die Entscheidung mit einer Begründung."
};

type ProblemBody = {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId?: string;
  errors?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

const sendProblem = (res: Response, body: ProblemBody) => {
  res.setHeader("Content-Type", "application/problem+json");
  if (body.requestId) {
    res.setHeader("x-request-id", body.requestId);
  }
  return res.status(body.status).json(body);
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
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = req.requestId;

  if (error instanceof AppError) {
    const detail = getMessageForAppError(error);
    return sendProblem(res, {
      type: `urn:toolshare:problem:${error.code.toLowerCase()}`,
      title: error.code.replaceAll("_", " "),
      status: error.status,
      detail,
      code: error.code,
      requestId
    });
  }

  if (error instanceof ZodError) {
    const flattened = error.flatten();
    return sendProblem(res, {
      type: "urn:toolshare:problem:validation-error",
      title: "VALIDATION ERROR",
      status: 400,
      detail: userFriendlyMessageByCode.VALIDATION_ERROR,
      code: "VALIDATION_ERROR",
      requestId,
      errors: flattened
    });
  }

  const exposeInternalDetails =
    process.env.NODE_ENV !== "production" || process.env.SHOW_INTERNAL_ERRORS === "true";

  if (exposeInternalDetails) {
    logger.error({ err: error, requestId }, "Internal server error");
  }

  const internalMessage =
    exposeInternalDetails && error instanceof Error
      ? error.message
      : "Es ist ein unerwarteter Serverfehler aufgetreten.";

  return sendProblem(res, {
    type: "urn:toolshare:problem:internal-server-error",
    title: "INTERNAL SERVER ERROR",
    status: 500,
    detail: internalMessage,
    code: "INTERNAL_SERVER_ERROR",
    requestId
  });
};
