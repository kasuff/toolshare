import { Booking, BookingType, PickupProposal, TimeslotProposal, Rating } from "@toolshare/shared";

export type BookingRow = Booking & {
  pickupProposals: PickupProposal[];
  timeslotProposals: TimeslotProposal[];
  providerName?: string;
  requesterName?: string;
  toolName?: string;
  isNotificationRead?: boolean;
  systemWarningText?: string;
};

export function parseSuspensionMessage(message: string): { reason: string } {
  if (!message.startsWith("SPERRUNG:")) return { reason: message };
  const content = message.replace("SPERRUNG:", "").trim();
  const reasonLine = content.split("\n").find((line) => line.trim().startsWith("Grund:"));
  return { reason: reasonLine ? reasonLine.replace("Grund:", "").trim() : content };
}

export function parseWarningMessage(message: string) {
  if (!message.startsWith("ERMAHNUNG:")) return { reason: message, moderator: "Moderator", hint: "" };
  const content = message.replace("ERMAHNUNG:", "").trim();
  const lines = content.split("\n");
  let reason = "", moderator = "Moderator", hint = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Moderator:")) moderator = trimmed.replace("Moderator:", "").trim();
    else if (trimmed.startsWith("Hinweis:")) hint = trimmed;
    else if (trimmed) {
      if (reason) reason += "\n" + trimmed;
      else reason = trimmed;
    }
  }
  return { reason, moderator, hint };
}

export const bookingTypeLabel: Record<BookingType, string> = {
  TOOL: "Werkzeug",
  WORKSHOP: "Werkstatt",
  SYSTEM_WARNING: "System-Meldung"
};

export function counterparty(booking: Booking, currentUserId: string): { name: string } {
  if (booking.type === "SYSTEM_WARNING") return { name: (booking as BookingRow).providerName ?? "System" };
  if (booking.providerId === currentUserId) return { name: (booking as BookingRow).requesterName ?? "Anfragender" };
  return { name: (booking as BookingRow).providerName ?? "Anbieter" };
}

export function formatShortClockOrDate(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

export function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function getLastActivityMs(booking: BookingRow, rating?: Rating | null): number {
  const createdMs = booking.createdIso ? new Date(booking.createdIso).getTime() : 0;
  let t = Number.isNaN(createdMs) ? 0 : createdMs;
  for (const p of booking.pickupProposals) {
    const ms = new Date(p.createdIso).getTime();
    if (!Number.isNaN(ms)) t = Math.max(t, ms);
  }
  for (const p of booking.timeslotProposals) {
    const ms = new Date(p.createdIso).getTime();
    if (!Number.isNaN(ms)) t = Math.max(t, ms);
  }
  if (rating?.createdIso && rating.status === "SICHTBAR") {
    const ms = new Date(rating.createdIso).getTime();
    if (!Number.isNaN(ms)) t = Math.max(t, ms);
  }
  return t;
}

export function getThreadPreview(row: BookingRow, currentUserId: string, rating?: Rating | null): string {
  if (row.type === "SYSTEM_WARNING") {
    if (row.systemWarningText?.startsWith("SPERRUNG:")) {
      return parseSuspensionMessage(row.systemWarningText).reason;
    }
    const parsed = parseWarningMessage(row.systemWarningText ?? "");
    return parsed.reason;
  }
  const latestPickup = row.pickupProposals.length > 0 ? row.pickupProposals[row.pickupProposals.length - 1] : null;
  const latestTimeslot = row.timeslotProposals.length > 0 ? row.timeslotProposals[row.timeslotProposals.length - 1] : null;
  const latestPickupMs = latestPickup ? new Date(latestPickup.createdIso).getTime() : 0;
  const latestTimeslotMs = latestTimeslot ? new Date(latestTimeslot.createdIso).getTime() : 0;
  const ratingMs = rating && rating.status === "SICHTBAR" && rating.createdIso ? new Date(rating.createdIso).getTime() : 0;
  const latestActivityMs = Math.max(latestPickupMs, latestTimeslotMs, ratingMs);

  if (rating && rating.status === "SICHTBAR" && ratingMs >= latestActivityMs) {
    if (rating.fromUserId === currentUserId) return `Du: ${rating.score} von 5 Sternen`;
    return `Bewertung · ${rating.score} von 5 Sternen`;
  }
  if (latestPickup && latestPickupMs >= latestTimeslotMs) {
    const short = formatShortDateTime(latestPickup.proposedPickupIso);
    if (latestPickup.proposedById === currentUserId) return `Du: Alternativ ${short}`;
    return `Alternativvorschlag · ${short}`;
  }
  if (latestTimeslot) {
    const short = formatShortDateTime(latestTimeslot.proposedStartIso);
    if (latestTimeslot.proposedById === currentUserId) return `Du: Alternativzeit ${short}`;
    return `Alternativzeit · ${short}`;
  }
  if (row.requesterId === currentUserId) {
    return row.type === "WORKSHOP" ? "Du hast eine Werkstatt angefragt" : "Du hast eine Ausleihe angefragt";
  }
  return row.type === "WORKSHOP"
    ? `${row.requesterName ?? "Jemand"} möchte „${row.toolName ?? "deine Werkstatt"}“ buchen`
    : `${row.requesterName ?? "Jemand"} möchte „${row.toolName ?? "dein Angebot"}“ ausleihen`;
}

export function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getPendingPickupProposal(booking: Booking): PickupProposal | null {
  const pending = (booking.pickupProposals ?? []).filter((p: PickupProposal) => p.status === "PENDING");
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

export function getPendingTimeslotProposal(booking: Booking): TimeslotProposal | null {
  const pending = (booking.timeslotProposals ?? []).filter((p: TimeslotProposal) => p.status === "PENDING");
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

export function splitIsoToLocalParts(iso: string): { date: string; time: string } {
  if (!iso.trim()) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function toToolRangeDraft(booking: Booking): DraftToolRangeParts {
  const latest = booking.pickupProposals?.length
    ? booking.pickupProposals[booking.pickupProposals.length - 1]
    : null;
  const pickup = splitIsoToLocalParts(latest?.proposedPickupIso ?? booking.pickupTimeIso ?? booking.startIso ?? "");
  const returnTime = splitIsoToLocalParts(latest?.proposedReturnIso ?? booking.endIso ?? "");
  return {
    pickupDate: pickup.date,
    pickupTime: pickup.time,
    returnDate: returnTime.date,
    returnTime: returnTime.time
  };
}

export function combineLocalDateTimeToIso(date: string, time: string): string | null {
  const dStr = date.trim();
  const tStr = time.trim();
  if (!dStr || !tStr) return null;
  const [y, m, day] = dStr.split("-").map(Number);
  const timeParts = tStr.split(":");
  const hh = Number(timeParts[0]);
  const mm = Number(timeParts[1] ?? 0);
  if (!y || !m || !day || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function toWorkshopDraft(booking: Booking): DraftWorkshopRangeParts {
  const latest = booking.timeslotProposals?.length
    ? booking.timeslotProposals[booking.timeslotProposals.length - 1]
    : null;
  const startIso = latest?.proposedStartIso ?? booking.startIso ?? "";
  const endIso = latest?.proposedEndIso ?? booking.endIso ?? "";
  const startParts = splitIsoToLocalParts(startIso);
  const endParts = splitIsoToLocalParts(endIso);
  if (!startParts.date) {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const pad = (value: number) => `${value}`.padStart(2, "0");
    return {
      startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      startTime: "10:00",
      endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
      endTime: "12:00"
    };
  }
  return {
    startDate: startParts.date,
    startTime: startParts.time || "10:00",
    endDate: endParts.date || startParts.date,
    endTime: endParts.time || "12:00"
  };
}

export function isBookingRateable(booking: Booking) {
  if (booking.status === "ABGELEHNT" || booking.status === "OFFEN") {
    return false;
  }
  if (booking.status === "ABGESCHLOSSEN") {
    return true;
  }
  if (!booking.endIso) {
    return false;
  }
  return new Date(booking.endIso) <= new Date();
}

export function buildConversationContext(booking: Booking, currentUserId: string, rating?: Rating | null): string {
  const lines: string[] = [];
  lines.push(`Booking ${booking.id} (${booking.type})`);
  lines.push(`Anfrage von ${booking.requesterName ?? booking.requesterId} an ${booking.providerName ?? booking.providerId}`);
  lines.push(`Status: ${booking.status}`);
  lines.push(`Zeitraum: ${formatDateTime(booking.startIso)} - ${formatDateTime(booking.endIso)}`);
  lines.push(`Abholung: ${formatDateTime(booking.pickupTimeIso)}`);
  lines.push(
    booking.requesterId === currentUserId
      ? "Nachricht 1 (Du): Ausleihanfrage erstellt"
      : `Nachricht 1 (${booking.requesterName ?? booking.requesterId}): Ausleihanfrage erstellt`
  );

  for (const proposal of booking.pickupProposals ?? []) {
    const sender = proposal.proposedById === currentUserId ? "Du" : proposal.proposedById;
    lines.push(
      `Alternativvorschlag (${sender}) ${formatDateTime(proposal.createdIso)}: ${formatDateTime(proposal.proposedPickupIso)} [${proposal.status}]`
    );
  }
  if (rating && rating.status === "SICHTBAR") {
    const sender = rating.fromUserId === currentUserId ? "Du" : (rating.fromUserName ?? rating.fromUserId);
    lines.push(
      `Bewertung (${sender}) ${formatDateTime(rating.createdIso)}: ${rating.score} von 5 Sternen${rating.comment ? ` – ${rating.comment}` : ""}`
    );
  }
  return lines.join("\n");
}
export type DraftToolRangeParts = {
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
};

export type DraftWorkshopRangeParts = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};
