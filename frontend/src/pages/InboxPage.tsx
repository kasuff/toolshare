import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { Booking, BookingStatus, BookingType, PickupProposal, User } from "../types/domain";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../utils/categories";
import {
  bookingHasUnreadForUser,
  collectAllMessageKeys,
  inboxReadSeedKey,
  INBOX_READ_CHANGED_EVENT,
  loadReadMessageIds,
  proposalMessageKey,
  requestMessageKey,
  saveReadMessageIds,
} from "../utils/inboxMessageRead";

type Props = {
  currentUser?: User;
  token?: string;
};

const bookingTypeLabel: Record<BookingType, string> = {
  TOOL: "Werkzeug",
  WORKSHOP: "Werkstatt",
};

const bookingStatusLabel: Record<BookingStatus, string> = {
  OFFEN: "Offen",
  BESTAETIGT: "Bestätigt",
  ABGELEHNT: "Abgelehnt",
  ABGESCHLOSSEN: "Abgeschlossen",
};

type DraftPickupParts = { date: string; time: string };

type BookingRow = Booking & {
  pickupProposals: PickupProposal[];
};

export function InboxPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [draftPickupByBooking, setDraftPickupByBooking] = useState<Record<string, DraftPickupParts>>({});
  const [isLoading, setIsLoading] = useState(false);
  const draftSeededForThreadRef = useRef<Set<string>>(new Set());
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const bookingResult = await api.getBookingsForUser(token);
      setBookings(bookingResult);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Inbox konnte nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData();
  }, [token]);

  useEffect(() => {
    draftSeededForThreadRef.current.clear();
  }, [token]);

  useEffect(() => {
    if (!currentUser?.id) {
      setReadMessageIds(new Set());
      return;
    }
    setReadMessageIds(loadReadMessageIds(currentUser.id));
  }, [currentUser?.id]);

  useLayoutEffect(() => {
    if (!currentUser?.id || bookings.length === 0) return;
    if (localStorage.getItem(inboxReadSeedKey(currentUser.id))) return;
    const keys = collectAllMessageKeys(bookings);
    const merged = new Set(loadReadMessageIds(currentUser.id));
    for (const k of keys) merged.add(k);
    saveReadMessageIds(currentUser.id, merged);
    localStorage.setItem(inboxReadSeedKey(currentUser.id), "1");
    setReadMessageIds(merged);
    window.dispatchEvent(new Event(INBOX_READ_CHANGED_EVENT));
  }, [currentUser?.id, bookings]);

  const bookingRows: BookingRow[] = useMemo(
    () => bookings.map((booking) => ({ ...booking, pickupProposals: booking.pickupProposals ?? [] })),
    [bookings]
  );

  const sortedRows = useMemo(() => {
    if (!currentUser?.id) return [...bookingRows];
    const uid = currentUser.id;
    return [...bookingRows].sort((a, b) => {
      const unreadA = threadHasUnread(a, uid, readMessageIds);
      const unreadB = threadHasUnread(b, uid, readMessageIds);
      if (unreadA !== unreadB) return unreadA ? -1 : 1;
      return getBookingCreatedMs(b) - getBookingCreatedMs(a);
    });
  }, [bookingRows, currentUser?.id, readMessageIds]);

  useEffect(() => {
    if (sortedRows.length === 0) {
      setSelectedBookingId(null);
      return;
    }
    if (!selectedBookingId || !sortedRows.some((booking) => booking.id === selectedBookingId)) {
      setSelectedBookingId(sortedRows[0].id);
    }
  }, [sortedRows, selectedBookingId]);

  const selectedBooking =
    sortedRows.find((booking) => booking.id === selectedBookingId) ?? (sortedRows.length > 0 ? sortedRows[0] : null);

  const selectedReqIncoming = Boolean(
    selectedBooking && currentUser && selectedBooking.requesterId !== currentUser.id
  );
  const selectedReqKey = selectedBooking ? requestMessageKey(selectedBooking.id) : "";
  const selectedReqUnread = Boolean(selectedReqIncoming && selectedBooking && !readMessageIds.has(selectedReqKey));

  useEffect(() => {
    if (!selectedBookingId) return;
    const row = sortedRows.find((b) => b.id === selectedBookingId);
    if (!row) return;
    if (draftSeededForThreadRef.current.has(selectedBookingId)) return;
    draftSeededForThreadRef.current.add(selectedBookingId);
    const baseIso = getEffectivePickupIso(row) ?? row.pickupTimeIso ?? "";
    setDraftPickupByBooking((prev) => ({
      ...prev,
      [selectedBookingId]: splitIsoToLocalParts(baseIso),
    }));
  }, [selectedBookingId, sortedRows]);

  const pendingProposal = selectedBooking ? getPendingProposal(selectedBooking) : null;

  const canRespondToCounter =
    Boolean(selectedBooking && pendingProposal && currentUser && pendingProposal.proposedById !== currentUser.id);
  const counterDraft = selectedBooking ? draftPickupByBooking[selectedBooking.id] : undefined;

  const isProvider = (b: Booking) => (currentUser ? b.providerId === currentUser.id : false);

  const markIncomingRead = (messageKey: string) => {
    if (!currentUser?.id) return;
    setReadMessageIds((prev) => {
      if (prev.has(messageKey)) return prev;
      const next = new Set(prev);
      next.add(messageKey);
      saveReadMessageIds(currentUser.id, next);
      window.dispatchEvent(new Event(INBOX_READ_CHANGED_EVENT));
      return next;
    });
  };

  const decide = async (bookingId: string, accept: boolean) => {
    if (!token) return;
    try {
      await api.decideBooking(bookingId, accept ? "BESTAETIGT" : "ABGELEHNT", token);
      await loadData();
      pushToast(`Anfrage ${accept ? "bestätigt" : "abgelehnt"}.`, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Status konnte nicht gesetzt werden.", "error");
    }
  };

  const sendCounterProposal = async (booking: Booking) => {
    if (!token || !currentUser) return;
    if (booking.type !== "TOOL" || !booking.pickupTimeIso) {
      pushToast("Alternativvorschlag ist nur bei Ausleihanfragen mit Abholzeit möglich.", "error");
      return;
    }
    const parts = draftPickupByBooking[booking.id];
    const iso = combineLocalDateTimeToIso(parts?.date ?? "", parts?.time ?? "");
    if (!iso) {
      pushToast("Bitte Datum und Uhrzeit für den Alternativvorschlag wählen.", "error");
      return;
    }
    const payloadIso = clampPickupIsoToBooking(iso, booking);
    if (payloadIso !== iso) {
      pushToast("Abholzeit wurde auf den Buchungszeitraum begrenzt.", "info");
    }
    const pendingIncoming = getPendingProposal(booking);
    if (pendingIncoming && pendingIncoming.proposedById !== currentUser.id) {
      markIncomingRead(proposalMessageKey(booking.id, pendingIncoming.id));
    }
    try {
      await api.createPickupProposal(booking.id, payloadIso, token);
      await loadData();
      setDraftPickupByBooking((prev) => ({
        ...prev,
        [booking.id]: { date: "", time: "" },
      }));
      pushToast("Alternativvorschlag gesendet.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Alternativvorschlag konnte nicht gesendet werden.", "error");
    }
  };

  const acceptLatestCounterProposal = async (booking: Booking) => {
    const pending = getPendingProposal(booking);
    if (!token || !pending) return;
    markIncomingRead(proposalMessageKey(booking.id, pending.id));
    try {
      await api.respondPickupProposal(booking.id, pending.id, "ACCEPT", token);
      await loadData();
      pushToast("Alternativvorschlag angenommen.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Vorschlag konnte nicht angenommen werden.", "error");
    }
  };

  const declineLatestCounterProposal = async (booking: Booking) => {
    const pending = getPendingProposal(booking);
    if (!token || !pending) return;
    markIncomingRead(proposalMessageKey(booking.id, pending.id));
    try {
      await api.respondPickupProposal(booking.id, pending.id, "DECLINE", token);
      await loadData();
      pushToast("Alternativvorschlag abgelehnt.", "info");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Vorschlag konnte nicht abgelehnt werden.", "error");
    }
  };

  const close = async (bookingId: string) => {
    if (!token) return;
    try {
      await api.decideBooking(bookingId, "ABGESCHLOSSEN", token);
      await loadData();
      pushToast("Buchung als abgeschlossen markiert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Buchung konnte nicht abgeschlossen werden.", "error");
    }
  };

  if (!token || !currentUser) {
    return (
      <section className="stack">
        <h1>Nachrichten</h1>
        <Surface title="Login erforderlich" subtitle="Nachrichten sind nur für eingeloggte Nutzer verfügbar">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  return (
    <section className="stack inbox-messenger-page">
      <header className="inbox-messenger-title-row">
        <h1>Nachrichten</h1>
        {isLoading && <span className="inbox-loading-hint">Laden…</span>}
      </header>

      <div className="messenger-shell">
        {sortedRows.length === 0 ? (
          <Surface title="Keine Konversationen">
            <EmptyState title="Noch nichts hier" text="Sobald jemand eine Ausleihe anfragt oder du eine sendest, erscheint die Unterhaltung hier." />
          </Surface>
        ) : (
          <>
            <aside className="messenger-thread-list" aria-label="Konversationen">
              {sortedRows.map((booking) => {
                const active = selectedBooking?.id === booking.id;
                const cp = counterparty(booking, currentUser.id);
                const preview = getThreadPreview(booking, currentUser.id);
                const lastAt = getLastActivityMs(booking);
                const threadUnread = threadHasUnread(booking, currentUser.id, readMessageIds);
                return (
                  <button
                    key={booking.id}
                    type="button"
                    className={`messenger-thread-item ${active ? "active" : ""}${threadUnread ? " messenger-thread-item--unread" : ""}`}
                    onClick={() => setSelectedBookingId(booking.id)}
                  >
                    <UserAvatar name={cp.name} imageUrl={null} size="md" />
                    <span className="messenger-thread-body">
                      <span className="messenger-thread-top">
                        <strong className="messenger-thread-name">{cp.name}</strong>
                        <time className="messenger-thread-time" dateTime={new Date(lastAt).toISOString()}>
                          {formatShortClockOrDate(lastAt)}
                        </time>
                      </span>
                      <span className="messenger-thread-sub">{booking.toolName ?? bookingTypeLabel[booking.type]}</span>
                      <span className="messenger-thread-preview">{preview}</span>
                    </span>
                  </button>
                );
              })}
            </aside>

            {selectedBooking && (
              <div className="messenger-chat">
                <header className="messenger-chat-header">
                  {(() => {
                    const cp = counterparty(selectedBooking, currentUser.id);
                    return (
                      <>
                        <UserAvatar name={cp.name} imageUrl={null} size="lg" />
                        <div className="messenger-chat-header-text">
                          <strong>{cp.name}</strong>
                          <span className="messenger-chat-header-sub">
                            {selectedBooking.toolName ?? `${bookingTypeLabel[selectedBooking.type]}-Anfrage`}
                          </span>
                        </div>
                        <StatusPill
                          label={bookingStatusLabel[selectedBooking.status]}
                          tone={
                            selectedBooking.status === "BESTAETIGT"
                              ? "success"
                              : selectedBooking.status === "ABGELEHNT"
                                ? "danger"
                                : "neutral"
                          }
                        />
                      </>
                    );
                  })()}
                </header>

                <div className="messenger-chat-scroll">
                  {/* Ausleihanfrage (wie erste Chat-Nachricht vom Anfragenden) */}
                  <MessengerRow
                    variant={selectedBooking.requesterId === currentUser.id ? "outgoing" : "incoming"}
                    avatar={
                      selectedBooking.requesterId !== currentUser.id ? (
                        <UserAvatar name={selectedBooking.requesterName ?? "Anfrage"} imageUrl={null} size="sm" />
                      ) : undefined
                    }
                  >
                    <div
                      className={`chat-bubble ${selectedBooking.requesterId === currentUser.id ? "outgoing" : "incoming"}${
                        selectedReqUnread ? " chat-bubble--unread" : ""
                      }`}
                      onClick={
                        selectedReqIncoming
                          ? () => {
                              markIncomingRead(selectedReqKey);
                            }
                          : undefined
                      }
                    >
                      <div className="request-bubble-card">
                        <div className="request-bubble-visual">
                          <img
                            src={selectedBooking.toolImageUrl || DEFAULT_PLACEHOLDER_IMAGE}
                            alt=""
                            className="request-bubble-thumb"
                          />
                          <div className="request-bubble-intro">
                            <span className="request-bubble-badge">Ausleihanfrage</span>
                            <p className="request-bubble-title">{selectedBooking.toolName ?? "Werkzeug"}</p>
                            <p
                              className={`request-bubble-line${selectedBooking.pickupProposals.length > 0 ? " is-struck" : ""}`}
                            >
                              Zeitraum: {formatDateTime(selectedBooking.startIso)} – {formatDateTime(selectedBooking.endIso)}
                            </p>
                            <p
                              className={`request-bubble-line${selectedBooking.pickupProposals.length > 0 ? " is-struck" : ""}`}
                            >
                              Abholung: {formatDateTime(selectedBooking.pickupTimeIso)}
                            </p>
                          </div>
                        </div>
                        <p className="request-bubble-status">
                          Status: <strong>{bookingStatusLabel[selectedBooking.status]}</strong>
                        </p>

                        {selectedBooking.status === "OFFEN" &&
                          isProvider(selectedBooking) &&
                          !pendingProposal &&
                          selectedBooking.type === "TOOL" &&
                          Boolean(selectedBooking.pickupTimeIso) && (
                          <>
                            <div className="request-bubble-actions">
                              <button type="button" onClick={() => void decide(selectedBooking.id, true)}>
                                Akzeptieren
                              </button>
                              <button type="button" className="ghost" onClick={() => void decide(selectedBooking.id, false)}>
                                Ablehnen
                              </button>
                            </div>
                            <div className="request-bubble-counter">
                              <span className="request-bubble-counter-label">Alternativvorschlag</span>
                              <div className="request-bubble-counter-row request-bubble-counter-datetime">
                                <input
                                  aria-label="Alternativdatum für Gegenvorschlag"
                                  type="date"
                                  className="booking-input"
                                  value={counterDraft?.date ?? ""}
                                  onChange={(event) =>
                                    setDraftPickupByBooking((prev) => ({
                                      ...prev,
                                      [selectedBooking.id]: {
                                        ...(prev[selectedBooking.id] ?? { date: "", time: "" }),
                                        date: event.target.value,
                                      },
                                    }))
                                  }
                                />
                                <input
                                  aria-label="Alternativuhrzeit für Gegenvorschlag"
                                  type="time"
                                  className="booking-input"
                                  value={counterDraft?.time ?? ""}
                                  onChange={(event) =>
                                    setDraftPickupByBooking((prev) => ({
                                      ...prev,
                                      [selectedBooking.id]: {
                                        ...(prev[selectedBooking.id] ?? { date: "", time: "" }),
                                        time: event.target.value,
                                      },
                                    }))
                                  }
                                />
                                <button type="button" onClick={() => void sendCounterProposal(selectedBooking)}>
                                  Senden
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </MessengerRow>

                  {selectedBooking.pickupProposals.map((proposal) => {
                    const propIncoming = proposal.proposedById !== currentUser.id;
                    const propKey = proposalMessageKey(selectedBooking.id, proposal.id);
                    const propUnread =
                      propIncoming && proposal.status === "PENDING" && !readMessageIds.has(propKey);
                    return (
                      <MessengerRow
                        key={proposal.id}
                        variant={proposal.proposedById === currentUser.id ? "outgoing" : "incoming"}
                        avatar={
                          proposal.proposedById !== currentUser.id ? (
                            <UserAvatar
                              name={
                                proposal.proposedById === selectedBooking.requesterId
                                  ? (selectedBooking.requesterName ?? "Anfrage")
                                  : (selectedBooking.providerName ?? "Anbieter")
                              }
                              imageUrl={null}
                              size="sm"
                            />
                          ) : undefined
                        }
                      >
                      <div
                        className={`chat-bubble ${proposal.proposedById === currentUser.id ? "outgoing" : "incoming"}${
                          propUnread ? " chat-bubble--unread" : ""
                        }`}
                        onClick={propIncoming ? () => markIncomingRead(propKey) : undefined}
                      >
                        <p>
                          Alternativvorschlag: Abholung {formatDateTime(proposal.proposedPickupIso)}
                          {proposal.previousPickupIso ? ` (statt ${formatDateTime(proposal.previousPickupIso)})` : ""}
                        </p>
                        <small>
                          {proposal.status === "PENDING"
                            ? "Warte auf Antwort"
                            : proposal.status === "ACCEPTED"
                              ? "Angenommen"
                              : "Abgelehnt"}
                        </small>

                        {canRespondToCounter &&
                          proposal.id === pendingProposal?.id &&
                          selectedBooking.status === "OFFEN" && (
                            <div className="proposal-reply-block" onClick={(event) => event.stopPropagation()}>
                              <div className="request-bubble-actions proposal-reply-actions">
                                <button type="button" onClick={() => void acceptLatestCounterProposal(selectedBooking)}>
                                  Annehmen
                                </button>
                                <button type="button" className="ghost" onClick={() => void declineLatestCounterProposal(selectedBooking)}>
                                  Ablehnen
                                </button>
                              </div>
                              {selectedBooking.type === "TOOL" && Boolean(selectedBooking.pickupTimeIso) && (
                                <div className="request-bubble-counter proposal-counter-inline">
                                  <span className="request-bubble-counter-label">Mit Alternativvorschlag antworten</span>
                                  <div className="request-bubble-counter-row request-bubble-counter-datetime">
                                    <input
                                      aria-label="Alternativdatum für Antwort auf diesen Vorschlag"
                                      type="date"
                                      className="booking-input"
                                      value={counterDraft?.date ?? ""}
                                      onChange={(event) =>
                                        setDraftPickupByBooking((prev) => ({
                                          ...prev,
                                          [selectedBooking.id]: {
                                            ...(prev[selectedBooking.id] ?? { date: "", time: "" }),
                                            date: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                    <input
                                      aria-label="Alternativuhrzeit für Antwort auf diesen Vorschlag"
                                      type="time"
                                      className="booking-input"
                                      value={counterDraft?.time ?? ""}
                                      onChange={(event) =>
                                        setDraftPickupByBooking((prev) => ({
                                          ...prev,
                                          [selectedBooking.id]: {
                                            ...(prev[selectedBooking.id] ?? { date: "", time: "" }),
                                            time: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                    <button type="button" onClick={() => void sendCounterProposal(selectedBooking)}>
                                      Senden
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                      </MessengerRow>
                    );
                  })}
                </div>

                {selectedBooking.status === "BESTAETIGT" && (
                  <footer className="messenger-chat-footer">
                    <button type="button" onClick={() => void close(selectedBooking.id)}>
                      Als abgeschlossen markieren
                    </button>
                  </footer>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function UserAvatar({
  name,
  imageUrl,
  size,
}: {
  name: string;
  imageUrl?: string | null;
  size: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const letter = initials || "?";

  if (imageUrl) {
    return <img src={imageUrl} alt="" className={`msg-avatar msg-avatar-${size}`} />;
  }

  return (
    <span className={`msg-avatar msg-avatar-${size} msg-avatar-fallback`} aria-hidden="true">
      {letter}
    </span>
  );
}

function MessengerRow({
  variant,
  avatar,
  children,
}: {
  variant: "incoming" | "outgoing";
  avatar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`messenger-msg-row ${variant}`}>
      {variant === "incoming" && avatar && <div className="messenger-msg-avatar-col">{avatar}</div>}
      <div className="messenger-msg-bubble-col">{children}</div>
    </div>
  );
}

function threadHasUnread(booking: BookingRow, currentUserId: string, readIds: Set<string>): boolean {
  return bookingHasUnreadForUser(booking, currentUserId, readIds);
}

function counterparty(booking: Booking, currentUserId: string): { name: string } {
  if (booking.providerId === currentUserId) {
    return { name: booking.requesterName ?? "Anfragender" };
  }
  return { name: booking.providerName ?? "Anbieter" };
}

function getThreadPreview(row: BookingRow, currentUserId: string): string {
  const proposals = row.pickupProposals;
  if (proposals.length > 0) {
    const last = proposals[proposals.length - 1];
    const short = formatShortDateTime(last.proposedPickupIso);
    if (last.proposedById === currentUserId) {
      return `Du: Alternativ ${short}`;
    }
    return `Alternativvorschlag · ${short}`;
  }
  if (row.requesterId === currentUserId) {
    return "Du hast eine Ausleihe angefragt";
  }
  return `${row.requesterName ?? "Jemand"} möchte „${row.toolName ?? "dein Angebot"}“ ausleihen`;
}

function getLastActivityMs(booking: BookingRow): number {
  let t = 0;
  for (const c of [booking.pickupTimeIso, booking.startIso, booking.createdIso]) {
    if (c) t = Math.max(t, new Date(c).getTime());
  }
  for (const p of booking.pickupProposals) {
    t = Math.max(t, new Date(p.createdIso).getTime());
  }
  return t;
}

function getBookingCreatedMs(booking: BookingRow): number {
  if (!booking.createdIso) return 0;
  const ms = new Date(booking.createdIso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function formatShortClockOrDate(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getPendingProposal(booking: Booking): PickupProposal | null {
  const pending = (booking.pickupProposals ?? []).filter((p) => p.status === "PENDING");
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

function getEffectivePickupIso(booking: Booking): string | undefined {
  const proposals = booking.pickupProposals ?? [];
  if (proposals.length === 0) return booking.pickupTimeIso;
  return proposals[proposals.length - 1].proposedPickupIso;
}

function splitIsoToLocalParts(iso: string): DraftPickupParts {
  if (!iso.trim()) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function combineLocalDateTimeToIso(date: string, time: string): string | null {
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

function clampPickupIsoToBooking(iso: string, booking: Booking): string {
  const p = new Date(iso).getTime();
  const s = booking.startIso ? new Date(booking.startIso).getTime() : NaN;
  const e = booking.endIso ? new Date(booking.endIso).getTime() : NaN;
  if (Number.isNaN(p) || Number.isNaN(s) || Number.isNaN(e)) return iso;
  const clamped = Math.min(Math.max(p, s), e);
  return new Date(clamped).toISOString();
}
