import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { KebabMenu } from "../components/KebabMenu";
import { ReportFormPanel } from "../components/ReportFormPanel";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { Booking, BookingStatus, BookingType, PickupProposal, TimeslotProposal, User } from "../types/domain";
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

type DraftToolRangeParts = {
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
};
type DraftWorkshopRangeParts = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

type BookingRow = Booking & {
  pickupProposals: PickupProposal[];
  timeslotProposals: TimeslotProposal[];
};

export function InboxPage({ currentUser, token }: Props) {
  const location = useLocation();
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [draftPickupByBooking, setDraftPickupByBooking] = useState<Record<string, DraftToolRangeParts>>({});
  const [draftWorkshopRangeByBooking, setDraftWorkshopRangeByBooking] = useState<
    Record<string, DraftWorkshopRangeParts>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [showUserReportForm, setShowUserReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReportingUser, setIsReportingUser] = useState(false);
  const [counterFormBookingId, setCounterFormBookingId] = useState<string | null>(null);
  const draftSeededForThreadRef = useRef<Set<string>>(new Set());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      setBookings(await api.getBookingsForUser(token));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Inbox konnte nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    () =>
      bookings.map((booking) => ({
        ...booking,
        pickupProposals: booking.pickupProposals ?? [],
        timeslotProposals: booking.timeslotProposals ?? []
      })),
    [bookings]
  );

  const sortedRows = useMemo(() => {
    return [...bookingRows].sort((a, b) => getLastActivityMs(b) - getLastActivityMs(a));
  }, [bookingRows]);

  useEffect(() => {
    if (sortedRows.length === 0) {
      setSelectedBookingId(null);
      return;
    }
    if (!selectedBookingId || !sortedRows.some((booking) => booking.id === selectedBookingId)) {
      const requestedBookingId =
        typeof (location.state as { bookingId?: unknown } | null)?.bookingId === "string"
          ? (location.state as { bookingId: string }).bookingId
          : null;
      const requestedBooking = requestedBookingId
        ? sortedRows.find((booking) => booking.id === requestedBookingId)
        : null;
      setSelectedBookingId(requestedBooking?.id ?? sortedRows[0].id);
    }
  }, [location.state, sortedRows, selectedBookingId]);

  useEffect(() => {
    setShowUserReportForm(false);
    setReportReason("");
    setReportDetails("");
    setCounterFormBookingId(null);
  }, [selectedBookingId]);

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
    setDraftPickupByBooking((prev) => ({
      ...prev,
      [selectedBookingId]: toToolRangeDraft(row),
    }));
    if (row.type === "WORKSHOP") {
      setDraftWorkshopRangeByBooking((prev) => ({
        ...prev,
        [selectedBookingId]: toWorkshopDraft(row),
      }));
    }
  }, [selectedBookingId, sortedRows]);

  const pendingPickupProposal =
    selectedBooking?.type === "TOOL" ? getPendingPickupProposal(selectedBooking) : null;
  const pendingTimeslotProposal =
    selectedBooking?.type === "WORKSHOP" ? getPendingTimeslotProposal(selectedBooking) : null;

  const canRespondToPickupCounter =
    Boolean(selectedBooking && pendingPickupProposal && currentUser && pendingPickupProposal.proposedById !== currentUser.id);
  const canRespondToTimeslotCounter =
    Boolean(
      selectedBooking &&
        pendingTimeslotProposal &&
        currentUser &&
        pendingTimeslotProposal.proposedById !== currentUser.id
    );
  const counterDraft = selectedBooking ? draftPickupByBooking[selectedBooking.id] : undefined;
  const workshopRangeDraft = selectedBooking ? draftWorkshopRangeByBooking[selectedBooking.id] : undefined;

  const isProvider = (b: Booking) => (currentUser ? b.providerId === currentUser.id : false);

  useLayoutEffect(() => {
    const chat = chatScrollRef.current;
    if (!chat || !selectedBooking) return;
    chat.scrollTop = chat.scrollHeight;
  }, [
    selectedBooking,
    selectedBookingId,
    selectedBooking?.status,
    selectedBooking?.pickupProposals.length,
    selectedBooking?.timeslotProposals.length,
    counterFormBookingId
  ]);

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

  const sendPickupCounterProposal = async (booking: Booking) => {
    if (!token || !currentUser) return;
    if (booking.type !== "TOOL" || !booking.pickupTimeIso) {
      pushToast("Alternativvorschlag ist nur bei Ausleihanfragen mit Abholzeit möglich.", "error");
      return;
    }
    const draft = draftPickupByBooking[booking.id];
    const pickupIso = combineLocalDateTimeToIso(draft?.pickupDate ?? "", draft?.pickupTime ?? "");
    const returnIso = combineLocalDateTimeToIso(draft?.returnDate ?? "", draft?.returnTime ?? "");
    if (!pickupIso || !returnIso) {
      pushToast("Bitte Abholung und Rückgabe jeweils mit Datum und Uhrzeit wählen.", "error");
      return;
    }
    if (new Date(returnIso).getTime() <= new Date(pickupIso).getTime()) {
      pushToast("Die Rückgabe muss nach der Abholung liegen.", "error");
      return;
    }
    const pendingIncoming = getPendingPickupProposal(booking);
    if (pendingIncoming && pendingIncoming.proposedById !== currentUser.id) {
      markIncomingRead(proposalMessageKey(booking.id, pendingIncoming.id));
    }
    try {
      await api.createPickupProposal(booking.id, pickupIso, returnIso, token);
      await loadData();
      setDraftPickupByBooking((prev) => ({
        ...prev,
        [booking.id]: toToolRangeDraft(booking),
      }));
      setCounterFormBookingId(null);
      pushToast("Alternativvorschlag gesendet.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Alternativvorschlag konnte nicht gesendet werden.", "error");
    }
  };

  const sendTimeslotCounterProposal = async (booking: Booking) => {
    if (!token || !currentUser) return;
    if (booking.type !== "WORKSHOP") {
      pushToast("Alternativvorschlag ist hier nicht verfügbar.", "error");
      return;
    }
    const draft = draftWorkshopRangeByBooking[booking.id];
    const startIso = combineLocalDateTimeToIso(draft?.startDate ?? "", draft?.startTime ?? "");
    const endIso = combineLocalDateTimeToIso(draft?.endDate ?? "", draft?.endTime ?? "");
    if (!startIso || !endIso) {
      pushToast("Bitte Start- und Enddatum jeweils mit Uhrzeit wählen.", "error");
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      pushToast("Das Ende muss nach dem Start liegen.", "error");
      return;
    }
    const pendingIncoming = getPendingTimeslotProposal(booking);
    if (pendingIncoming && pendingIncoming.proposedById !== currentUser.id) {
      markIncomingRead(proposalMessageKey(booking.id, pendingIncoming.id));
    }
    try {
      await api.createTimeslotProposal(booking.id, startIso, endIso, token);
      await loadData();
      setDraftWorkshopRangeByBooking((prev) => ({ ...prev, [booking.id]: toWorkshopDraft(booking) }));
      setCounterFormBookingId(null);
      pushToast("Alternativzeitraum gesendet.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Alternativzeitraum konnte nicht gesendet werden.", "error");
    }
  };

  const acceptLatestCounterProposal = async (booking: Booking) => {
    const pending = getPendingPickupProposal(booking);
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
    const pending = getPendingPickupProposal(booking);
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

  const acceptLatestTimeslotProposal = async (booking: Booking) => {
    const pending = getPendingTimeslotProposal(booking);
    if (!token || !pending) return;
    markIncomingRead(proposalMessageKey(booking.id, pending.id));
    try {
      await api.respondTimeslotProposal(booking.id, pending.id, "ACCEPT", token);
      await loadData();
      pushToast("Alternativzeit angenommen.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Alternativzeit konnte nicht angenommen werden.", "error");
    }
  };

  const declineLatestTimeslotProposal = async (booking: Booking) => {
    const pending = getPendingTimeslotProposal(booking);
    if (!token || !pending) return;
    markIncomingRead(proposalMessageKey(booking.id, pending.id));
    try {
      await api.respondTimeslotProposal(booking.id, pending.id, "DECLINE", token);
      await loadData();
      pushToast("Alternativzeit abgelehnt.", "info");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Alternativzeit konnte nicht abgelehnt werden.", "error");
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

  const closeUserReportForm = () => {
    setShowUserReportForm(false);
    setReportReason("");
    setReportDetails("");
  };

  const reportCurrentCounterparty = async () => {
    if (!token || !currentUser || !selectedBooking) return;
    if (reportReason.trim().length < 5) {
      pushToast("Bitte gib einen Grund mit mindestens 5 Zeichen an.", "error");
      return;
    }
    const counterpartId = selectedBooking.providerId === currentUser.id ? selectedBooking.requesterId : selectedBooking.providerId;
    const conversationContext = buildConversationContext(selectedBooking, currentUser.id);

    setIsReportingUser(true);
    try {
      await api.createReport(
        {
          targetType: "USER",
          targetId: counterpartId,
          bookingId: selectedBooking.id,
          reason: reportReason.trim(),
          details: reportDetails.trim() || undefined,
          conversationContext
        },
        token
      );
      closeUserReportForm();
      pushToast("Nutzer wurde gemeldet. Der Chatverlauf wurde als Kontext übermittelt.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Nutzer konnte nicht gemeldet werden.", "error");
    } finally {
      setIsReportingUser(false);
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

      {sortedRows.length === 0 ? (
        <Surface title="Keine Konversationen">
          <EmptyState title="Noch nichts hier" text="Sobald jemand eine Ausleihe anfragt oder du eine sendest, erscheint die Unterhaltung hier." />
        </Surface>
      ) : (
        <div className="messenger-shell">
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
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelectedBookingId(booking.id)}
                >
                  <span className="messenger-thread-avatar-wrap">
                    <UserAvatar name={cp.name} imageUrl={null} size="md" />
                    {threadUnread && (
                      <span className="messenger-thread-unread-badge" aria-label="1 neue Nachricht">
                        1
                      </span>
                    )}
                  </span>
                  <span className="messenger-thread-body">
                    <span className="messenger-thread-top">
                      <span className="messenger-thread-sub">{cp.name}</span>
                      <time className="messenger-thread-time" dateTime={new Date(lastAt).toISOString()}>
                        {formatShortClockOrDate(lastAt)}
                      </time>
                    </span>
                    <strong className="messenger-thread-name">
                      {booking.toolName ?? bookingTypeLabel[booking.type]}
                    </strong>
                    <span className="messenger-thread-preview">{preview}</span>
                  </span>
                </button>
              );
            })}
          </aside>

          {selectedBooking && (
            <div className="messenger-chat">
              <header className="messenger-chat-header">
                <UserAvatar
                  name={counterparty(selectedBooking, currentUser.id).name}
                  imageUrl={null}
                  size="lg"
                />
                <div className="messenger-chat-header-text">
                  <strong>{selectedBooking.toolName ?? `${bookingTypeLabel[selectedBooking.type]}-Anfrage`}</strong>
                  <span className="messenger-chat-header-sub">{counterparty(selectedBooking, currentUser.id).name}</span>
                </div>
                <div className="messenger-chat-header-actions">
                  <StatusPill
                    label={bookingStatusLabel[selectedBooking.status]}
                    tone={
                      selectedBooking.status === "BESTAETIGT" || selectedBooking.status === "ABGESCHLOSSEN"
                        ? "success"
                        : selectedBooking.status === "ABGELEHNT"
                          ? "danger"
                          : "neutral"
                    }
                  />
                  <KebabMenu
                    ariaLabel="Konversationsaktionen"
                    items={[
                      {
                        id: "report-user",
                        label: "Nutzer melden",
                        onSelect: () => setShowUserReportForm(true)
                      }
                    ]}
                  />
                </div>
              </header>

              {showUserReportForm && (
                <ReportFormPanel
                  title="Nutzer melden"
                  hint="Der komplette Chatverlauf wird als Kontext zur Meldung gespeichert."
                  reason={reportReason}
                  details={reportDetails}
                  isSubmitting={isReportingUser}
                  submitLabel="Nutzer melden"
                  onReasonChange={setReportReason}
                  onDetailsChange={setReportDetails}
                  onSubmit={() => void reportCurrentCounterparty()}
                  onCancel={closeUserReportForm}
                />
              )}

              <div className="messenger-chat-scroll" ref={chatScrollRef}>
                <MessengerRow
                  variant={selectedBooking.requesterId === currentUser.id ? "outgoing" : "incoming"}
                  avatar={<UserAvatar name={selectedBooking.requesterName ?? currentUser.name} imageUrl={null} size="sm" />}
                >
                  <RequestMessageCard
                    label={selectedBooking.type === "WORKSHOP" ? "Werkstattbuchung" : "Ausleihanfrage"}
                    title={selectedBooking.toolName ?? (selectedBooking.type === "WORKSHOP" ? "Werkstatt" : "Werkzeug")}
                    icon={selectedBooking.type === "WORKSHOP" ? "home_repair_service" : "construction"}
                    firstLabel={selectedBooking.type === "TOOL" ? "Abholung" : "Von"}
                    firstValue={formatDateTime(
                      selectedBooking.type === "TOOL" ? selectedBooking.pickupTimeIso : selectedBooking.startIso
                    )}
                    secondLabel={selectedBooking.type === "TOOL" ? "Rückgabe" : "Bis"}
                    secondValue={formatDateTime(selectedBooking.endIso)}
                    unread={selectedReqUnread}
                    onClick={selectedReqIncoming ? () => markIncomingRead(selectedReqKey) : undefined}
                  />
                </MessengerRow>

                {selectedBooking.pickupProposals.map((proposal) => {
                  const incoming = proposal.proposedById !== currentUser.id;
                  const key = proposalMessageKey(selectedBooking.id, proposal.id);
                  return (
                    <MessengerRow
                      key={proposal.id}
                      variant={incoming ? "incoming" : "outgoing"}
                      avatar={
                        <UserAvatar
                          name={incoming ? counterparty(selectedBooking, currentUser.id).name : currentUser.name}
                          imageUrl={null}
                          size="sm"
                        />
                      }
                    >
                      <RequestMessageCard
                        label={`Alternativvorschlag · ${proposalStatusLabel(proposal.status)}`}
                        title={selectedBooking.toolName ?? "Werkzeug"}
                        icon="help"
                        firstLabel="Abholung"
                        firstValue={formatDateTime(proposal.proposedPickupIso)}
                        secondLabel="Rückgabe"
                        secondValue={formatDateTime(proposal.proposedReturnIso ?? selectedBooking.endIso)}
                        unread={incoming && proposal.status === "PENDING" && !readMessageIds.has(key)}
                        onClick={incoming ? () => markIncomingRead(key) : undefined}
                      />
                    </MessengerRow>
                  );
                })}

                {selectedBooking.timeslotProposals.map((proposal) => {
                  const incoming = proposal.proposedById !== currentUser.id;
                  const key = proposalMessageKey(selectedBooking.id, proposal.id);
                  return (
                    <MessengerRow
                      key={proposal.id}
                      variant={incoming ? "incoming" : "outgoing"}
                      avatar={
                        <UserAvatar
                          name={incoming ? counterparty(selectedBooking, currentUser.id).name : currentUser.name}
                          imageUrl={null}
                          size="sm"
                        />
                      }
                    >
                      <RequestMessageCard
                        label={`Alternativvorschlag · ${proposalStatusLabel(proposal.status)}`}
                        title={selectedBooking.toolName ?? "Werkstatt"}
                        icon="help"
                        firstLabel="Von"
                        firstValue={formatDateTime(proposal.proposedStartIso)}
                        secondLabel="Bis"
                        secondValue={formatDateTime(proposal.proposedEndIso)}
                        unread={incoming && proposal.status === "PENDING" && !readMessageIds.has(key)}
                        onClick={incoming ? () => markIncomingRead(key) : undefined}
                      />
                    </MessengerRow>
                  );
                })}

                {selectedBooking.status !== "OFFEN" && (
                  <MessengerRow
                    variant={selectedBooking.providerId === currentUser.id ? "outgoing" : "incoming"}
                    avatar={<UserAvatar name={selectedBooking.providerName ?? currentUser.name} imageUrl={null} size="sm" />}
                  >
                    <RequestMessageCard
                      label={
                        selectedBooking.status === "BESTAETIGT"
                          ? "Anfrage angenommen"
                          : selectedBooking.status === "ABGELEHNT"
                            ? "Anfrage abgelehnt"
                            : "Buchung abgeschlossen"
                      }
                      title={selectedBooking.toolName ?? bookingTypeLabel[selectedBooking.type]}
                      icon={
                        selectedBooking.status === "BESTAETIGT"
                          ? "check"
                          : selectedBooking.status === "ABGELEHNT"
                            ? "close"
                            : "task_alt"
                      }
                      firstLabel="Von"
                      firstValue={formatDateTime(selectedBooking.startIso)}
                      secondLabel="Bis"
                      secondValue={formatDateTime(selectedBooking.endIso)}
                    />
                  </MessengerRow>
                )}

                {counterFormBookingId === selectedBooking.id && selectedBooking.status === "OFFEN" && (
                  <MessengerRow
                    variant="outgoing"
                    avatar={<UserAvatar name={currentUser.name} imageUrl={null} size="sm" />}
                  >
                    <RequestMessageCard
                      label="Alternativvorschlag"
                      title={selectedBooking.toolName ?? bookingTypeLabel[selectedBooking.type]}
                      icon="help"
                    >
                      {selectedBooking.type === "TOOL" ? (
                        <div className="request-card-form-grid request-card-form-grid--workshop">
                          <label>
                            <span>Abholdatum</span>
                            <input
                              aria-label="Alternatives Abholdatum"
                              type="date"
                              value={counterDraft?.pickupDate ?? ""}
                              onChange={(event) =>
                                setDraftPickupByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toToolRangeDraft(selectedBooking)),
                                    pickupDate: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Abholzeit</span>
                            <input
                              aria-label="Alternative Abholzeit"
                              type="time"
                              value={counterDraft?.pickupTime ?? ""}
                              onChange={(event) =>
                                setDraftPickupByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toToolRangeDraft(selectedBooking)),
                                    pickupTime: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Rückgabedatum</span>
                            <input
                              aria-label="Alternatives Rückgabedatum"
                              type="date"
                              value={counterDraft?.returnDate ?? ""}
                              onChange={(event) =>
                                setDraftPickupByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toToolRangeDraft(selectedBooking)),
                                    returnDate: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Rückgabezeit</span>
                            <input
                              aria-label="Alternative Rückgabezeit"
                              type="time"
                              value={counterDraft?.returnTime ?? ""}
                              onChange={(event) =>
                                setDraftPickupByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toToolRangeDraft(selectedBooking)),
                                    returnTime: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="request-card-form-grid request-card-form-grid--workshop">
                          <label>
                            <span>Startdatum</span>
                            <input
                              aria-label="Alternativdatum für Werkstattvorschlag"
                              type="date"
                              value={workshopRangeDraft?.startDate ?? ""}
                              onChange={(event) =>
                                setDraftWorkshopRangeByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toWorkshopDraft(selectedBooking)),
                                    startDate: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Uhrzeit</span>
                            <input
                              aria-label="Alternativuhrzeit für Werkstattvorschlag"
                              type="time"
                              value={workshopRangeDraft?.startTime ?? ""}
                              onChange={(event) =>
                                setDraftWorkshopRangeByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toWorkshopDraft(selectedBooking)),
                                    startTime: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Enddatum</span>
                            <input
                              aria-label="Alternativ-Enddatum für Werkstattvorschlag"
                              type="date"
                              value={workshopRangeDraft?.endDate ?? ""}
                              onChange={(event) =>
                                setDraftWorkshopRangeByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toWorkshopDraft(selectedBooking)),
                                    endDate: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Uhrzeit</span>
                            <input
                              aria-label="Alternativ-Enduhrzeit für Werkstattvorschlag"
                              type="time"
                              value={workshopRangeDraft?.endTime ?? ""}
                              onChange={(event) =>
                                setDraftWorkshopRangeByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toWorkshopDraft(selectedBooking)),
                                    endTime: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                        </div>
                      )}
                      <div className="request-card-form-actions">
                        <button type="button" className="ghost" onClick={() => setCounterFormBookingId(null)}>
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          className="request-card-send-button"
                          aria-label="Alternativvorschlag senden"
                          onClick={() =>
                            void (selectedBooking.type === "TOOL"
                              ? sendPickupCounterProposal(selectedBooking)
                              : sendTimeslotCounterProposal(selectedBooking))
                          }
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">send</span>
                        </button>
                      </div>
                    </RequestMessageCard>
                  </MessengerRow>
                )}
              </div>

              {selectedBooking.status === "OFFEN" && counterFormBookingId !== selectedBooking.id && (
                <>
                  {isProvider(selectedBooking) && !pendingPickupProposal && !pendingTimeslotProposal && (
                    <footer className="messenger-chat-footer messenger-chat-footer--actions">
                      <button type="button" onClick={() => void decide(selectedBooking.id, true)}>
                        Akzeptieren
                      </button>
                      <button type="button" className="secondary" onClick={() => setCounterFormBookingId(selectedBooking.id)}>
                        Alternativvorschlag senden
                      </button>
                      <button type="button" className="ghost inbox-reject-button" onClick={() => void decide(selectedBooking.id, false)}>
                        Ablehnen
                      </button>
                    </footer>
                  )}
                  {(canRespondToPickupCounter || canRespondToTimeslotCounter) && (
                    <footer className="messenger-chat-footer messenger-chat-footer--actions">
                      <button
                        type="button"
                        onClick={() =>
                          void (canRespondToPickupCounter
                            ? acceptLatestCounterProposal(selectedBooking)
                            : acceptLatestTimeslotProposal(selectedBooking))
                        }
                      >
                        Annehmen
                      </button>
                      <button type="button" className="secondary" onClick={() => setCounterFormBookingId(selectedBooking.id)}>
                        Alternativvorschlag senden
                      </button>
                      <button
                        type="button"
                        className="ghost inbox-reject-button"
                        onClick={() =>
                          void (canRespondToPickupCounter
                            ? declineLatestCounterProposal(selectedBooking)
                            : declineLatestTimeslotProposal(selectedBooking))
                        }
                      >
                        Ablehnen
                      </button>
                    </footer>
                  )}
                </>
              )}

              {selectedBooking.status === "BESTAETIGT" && (
                <footer className="messenger-chat-footer messenger-chat-footer--completion">
                  <button type="button" onClick={() => void close(selectedBooking.id)}>
                    Als abgeschlossen markieren
                  </button>
                </footer>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function buildConversationContext(booking: Booking, currentUserId: string): string {
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
  return lines.join("\n");
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
      {variant === "outgoing" && avatar && <div className="messenger-msg-avatar-col">{avatar}</div>}
    </div>
  );
}

function RequestMessageCard({
  label,
  title,
  icon,
  firstLabel,
  firstValue,
  secondLabel,
  secondValue,
  unread = false,
  onClick,
  children
}: {
  label: string;
  title: string;
  icon: string;
  firstLabel?: string;
  firstValue?: string;
  secondLabel?: string;
  secondValue?: string;
  unread?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <article
      className={`request-message-card${unread ? " request-message-card--unread" : ""}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="request-message-card-head">
        <span className="request-message-card-icon" aria-hidden="true">
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        <div className="request-message-card-heading">
          <span>{label}</span>
          <h3>{title}</h3>
        </div>
      </div>
      {firstLabel && firstValue && secondLabel && secondValue && (
        <div className="request-message-card-metadata">
          <div>
            <span>{firstLabel}</span>
            <strong>{firstValue}</strong>
          </div>
          <div>
            <span>{secondLabel}</span>
            <strong>{secondValue}</strong>
          </div>
        </div>
      )}
      {children}
    </article>
  );
}

function proposalStatusLabel(status: PickupProposal["status"] | TimeslotProposal["status"]): string {
  if (status === "ACCEPTED") return "Angenommen";
  if (status === "DECLINED") return "Abgelehnt";
  return "Warte auf Antwort";
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
  const latestPickup =
    row.pickupProposals.length > 0 ? row.pickupProposals[row.pickupProposals.length - 1] : null;
  const latestTimeslot =
    row.timeslotProposals.length > 0 ? row.timeslotProposals[row.timeslotProposals.length - 1] : null;

  const latestPickupMs = latestPickup ? new Date(latestPickup.createdIso).getTime() : 0;
  const latestTimeslotMs = latestTimeslot ? new Date(latestTimeslot.createdIso).getTime() : 0;

  if (latestPickup && latestPickupMs >= latestTimeslotMs) {
    const short = formatShortDateTime(latestPickup.proposedPickupIso);
    if (latestPickup.proposedById === currentUserId) {
      return `Du: Alternativ ${short}`;
    }
    return `Alternativvorschlag · ${short}`;
  }

  if (latestTimeslot) {
    const short = formatShortDateTime(latestTimeslot.proposedStartIso);
    if (latestTimeslot.proposedById === currentUserId) {
      return `Du: Alternativzeit ${short}`;
    }
    return `Alternativzeit · ${short}`;
  }

  if (row.requesterId === currentUserId) {
    return row.type === "WORKSHOP" ? "Du hast eine Werkstatt angefragt" : "Du hast eine Ausleihe angefragt";
  }
  return row.type === "WORKSHOP"
    ? `${row.requesterName ?? "Jemand"} möchte „${row.toolName ?? "deine Werkstatt"}“ buchen`
    : `${row.requesterName ?? "Jemand"} möchte „${row.toolName ?? "dein Angebot"}“ ausleihen`;
}

function getLastActivityMs(booking: BookingRow): number {
  const createdMs = booking.createdIso ? new Date(booking.createdIso).getTime() : 0;
  let t = Number.isNaN(createdMs) ? 0 : createdMs;
  for (const p of booking.pickupProposals) {
    t = Math.max(t, new Date(p.createdIso).getTime());
  }
  for (const p of booking.timeslotProposals) {
    t = Math.max(t, new Date(p.createdIso).getTime());
  }
  return t;
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
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSlotRange(startIso?: string, endIso?: string) {
  return `${formatDateTime(startIso)} – ${formatDateTime(endIso)}`;
}

function getPendingPickupProposal(booking: Booking): PickupProposal | null {
  const pending = (booking.pickupProposals ?? []).filter((p) => p.status === "PENDING");
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

function getPendingTimeslotProposal(booking: Booking): TimeslotProposal | null {
  const pending = (booking.timeslotProposals ?? []).filter((p) => p.status === "PENDING");
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

function splitIsoToLocalParts(iso: string): { date: string; time: string } {
  if (!iso.trim()) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function toToolRangeDraft(booking: Booking): DraftToolRangeParts {
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

function toWorkshopDraft(booking: Booking): DraftWorkshopRangeParts {
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
