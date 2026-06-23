import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DateInput } from "../components/DateInput";
import { KebabMenu } from "../components/KebabMenu";
import { RatingFormPanel } from "../components/RatingFormPanel";
import { ReportFormPanel } from "../components/ReportFormPanel";
import { StarRatingDisplay } from "../components/StarRatingInput";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { InboxThreadList } from "../components/InboxThreadList";
import { UserAvatar } from "../components/UserAvatar";
import {
  MessengerRow,
  RequestMessageCard,
  bookingStatusLabel,
  getChatHeaderSubtitle,
  getChatHeaderTitle,
  getSystemWarningLabel,
  proposalStatusLabel,
  threadHasUnread,
} from "../components/inbox/inboxChatHelpers";
import { useToast } from "../hooks/useToast";
import { api } from "@toolshare/shared";

import type {
  Booking,
  BookingStatus,
  BookingType,
  PickupProposal,
  Rating,
  TimeslotProposal,
  User
} from "@toolshare/shared";
import { useInboxStore } from "../store/inboxStore";
import { usePageAuth } from "../hooks/usePageAuth";
import {
  proposalMessageKey,
  ratingMessageKey,
  requestMessageKey,
} from "../utils/inboxMessageRead";
import { canProviderCompleteBooking } from "../utils/bookingCompletion";
import {
  BookingRow,
  parseSuspensionMessage,
  parseWarningMessage,
  getLastActivityMs,
  counterparty,
  bookingTypeLabel,
  formatDateTime,
  getPendingPickupProposal,
  getPendingTimeslotProposal,
  toToolRangeDraft,
  combineLocalDateTimeToIso,
  toWorkshopDraft,
  isBookingRateable,
  buildConversationContext,
  DraftToolRangeParts,
  DraftWorkshopRangeParts
} from "../utils/inboxHelpers";


type Props = {
  currentUser?: User;
  token?: string;
};

function isInboxSystemNotification(message: string): boolean {
  return (
    message.startsWith("ERMAHNUNG:") ||
    message.startsWith("SPERRUNG:") ||
    message.includes("wurde storniert") ||
    message.includes("wurde gelöscht")
  );
}



const MOBILE_INBOX_MEDIA_QUERY = "(max-width: 900px)";

function useMobileInboxLayout() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_INBOX_MEDIA_QUERY).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_INBOX_MEDIA_QUERY);
    const onChange = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function InboxPage({ currentUser: propUser, token: propToken }: Props) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const location = useLocation();
  const isMobileInbox = useMobileInboxLayout();
  const { pushToast } = useToast();
  const bookings = useInboxStore((state) => state.bookings);
  const notifications = useInboxStore((state) => state.notifications);
  const ratingsGiven = useInboxStore((state) => state.ratingsGiven);
  const ratingsReceived = useInboxStore((state) => state.ratingsReceived);
  const readMessageIds = useInboxStore((state) => state.readMessageIds);
  const isLoading = useInboxStore((state) => state.isLoading);
  const fetchData = useInboxStore((state) => state.fetchData);
  const markMessageRead = useInboxStore((state) => state.markMessageRead);
  const markThreadReadStore = useInboxStore((state) => state.markThreadRead);
  const markNotificationReadStore = useInboxStore((state) => state.markNotificationRead);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [draftPickupByBooking, setDraftPickupByBooking] = useState<Record<string, DraftToolRangeParts>>({});
  const [draftWorkshopRangeByBooking, setDraftWorkshopRangeByBooking] = useState<
    Record<string, DraftWorkshopRangeParts>
  >({});
  const [showUserReportForm, setShowUserReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReportingUser, setIsReportingUser] = useState(false);
  const [counterFormBookingId, setCounterFormBookingId] = useState<string | null>(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const draftSeededForThreadRef = useRef<Set<string>>(new Set());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const threadButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const mobileBackButtonRef = useRef<HTMLButtonElement>(null);
  const mobileThreadToRestoreRef = useRef<string | null>(null);
  const shouldFocusMobileChatRef = useRef(false);

  const loadData = async () => {
    if (!token || !currentUser?.id) return;
    try {
      await fetchData(token, currentUser.id);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Inbox konnte nicht geladen werden.", "error");
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

  const bookingRows: BookingRow[] = useMemo(
    () => [
      ...bookings.map((booking) => ({
        ...booking,
        pickupProposals: booking.pickupProposals ?? [],
        timeslotProposals: booking.timeslotProposals ?? []
      })),
      ...notifications
        .filter((n) => isInboxSystemNotification(n.message))
        .map((n) => {
          const isWarning = n.message.startsWith("ERMAHNUNG:");
          const isSuspension = n.message.startsWith("SPERRUNG:");
          const parsed = isWarning
            ? parseWarningMessage(n.message)
            : isSuspension
              ? { reason: parseSuspensionMessage(n.message).reason, moderator: "Administration", hint: "" }
              : { reason: n.message, moderator: "System", hint: "" };
          return {
            id: n.id,
            type: "SYSTEM_WARNING" as BookingType,
            requesterId: currentUser?.id ?? "",
            providerId: "system",
            status: "BESTAETIGT" as BookingStatus,
            createdIso: n.createdIso,
            providerName: parsed.moderator,
            requesterName: currentUser?.name ?? "Du",
            toolName: isWarning ? "Ermahnung der Moderation" : isSuspension ? "Kontosperrung" : "System-Benachrichtigung",
            pickupProposals: [],
            timeslotProposals: [],
            selectedWorkshopTools: [],
            systemWarningText: n.message,
            isNotificationRead: n.read
          };
        })
    ],
    [bookings, notifications, currentUser]
  );

  const ratingsByBookingId = useMemo(() => {
    const map = new Map<string, Rating>();
    for (const rating of [...ratingsGiven, ...ratingsReceived]) {
      map.set(rating.bookingId, rating);
    }
    return map;
  }, [ratingsGiven, ratingsReceived]);

  const sortedRows = useMemo(() => {
    return [...bookingRows].sort((a, b) => {
      const ratingA = ratingsByBookingId.get(a.id);
      const ratingB = ratingsByBookingId.get(b.id);
      return getLastActivityMs(b, ratingB) - getLastActivityMs(a, ratingA);
    });
  }, [bookingRows, ratingsByBookingId]);

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
      if (requestedBooking) {
        if (isMobileInbox) {
          mobileThreadToRestoreRef.current = requestedBooking.id;
          shouldFocusMobileChatRef.current = true;
        }
        setSelectedBookingId(requestedBooking.id);
        return;
      }
      if (isMobileInbox) {
        setSelectedBookingId(null);
        return;
      }
      setSelectedBookingId(sortedRows[0].id);
    }
  }, [isMobileInbox, location.state, sortedRows, selectedBookingId]);

  const prevSelectedBookingIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Nur bei einem echten Threadwechsel die offenen Formulare leeren. Das erste
    // Festlegen (null -> erste ID) passiert asynchron nach dem ersten Render via
    // Auto-Auswahl; würde es hier zurücksetzen, könnte es ein gerade per Klick
    // geöffnetes Formular sofort wieder schließen (Race Auto-Auswahl vs. Klick).
    if (prevSelectedBookingIdRef.current !== null && prevSelectedBookingIdRef.current !== selectedBookingId) {
      setShowUserReportForm(false);
      setReportReason("");
      setReportDetails("");
      setCounterFormBookingId(null);
    }
    prevSelectedBookingIdRef.current = selectedBookingId;
  }, [selectedBookingId]);

  const selectedBooking =
    selectedBookingId != null
      ? sortedRows.find((booking) => booking.id === selectedBookingId) ?? null
      : isMobileInbox
        ? null
        : sortedRows[0] ?? null;

  const selectedReqIncoming = Boolean(
    selectedBooking && currentUser && selectedBooking.requesterId !== currentUser.id
  );
  const selectedReqKey = selectedBooking ? requestMessageKey(selectedBooking.id) : "";
  const selectedReqUnread = Boolean(selectedReqIncoming && selectedBooking && !readMessageIds.has(selectedReqKey));

  useLayoutEffect(() => {
    if (!isMobileInbox) return;
    if (selectedBookingId && shouldFocusMobileChatRef.current) {
      shouldFocusMobileChatRef.current = false;
      mobileBackButtonRef.current?.focus();
      return;
    }
    if (!selectedBookingId && mobileThreadToRestoreRef.current) {
      const threadId = mobileThreadToRestoreRef.current;
      mobileThreadToRestoreRef.current = null;
      threadButtonRefs.current.get(threadId)?.focus();
    }
  }, [isMobileInbox, selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId) return;
    const row = sortedRows.find((b) => b.id === selectedBookingId);
    if (!row) return;
    if (row.type === "SYSTEM_WARNING") {
      if (!row.isNotificationRead) {
        void markNotificationRead(row.id);
      }
      return;
    }
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
  const selectedBookingRating = selectedBooking ? ratingsByBookingId.get(selectedBooking.id) ?? null : null;
  const showRatingFooter = Boolean(
    currentUser &&
      selectedBooking &&
      selectedBooking.requesterId === currentUser.id &&
      isBookingRateable(selectedBooking) &&
      !selectedBookingRating
  );

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
    counterFormBookingId,
    selectedBookingRating?.id
  ]);

  const markIncomingRead = (messageKey: string) => {
    if (!currentUser?.id) return;
    markMessageRead(messageKey, currentUser.id);
  };

  const markThreadRead = (booking: BookingRow) => {
    if (!currentUser?.id) return;
    if (booking.type === "SYSTEM_WARNING") return;
    markThreadReadStore(booking, currentUser.id);
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!token) return;
    try {
      await markNotificationReadStore(notificationId, token);
    } catch (error) {
      console.error("Fehler beim Markieren der Benachrichtigung als gelesen:", error);
    }
  };

  const decide = async (bookingId: string, accept: boolean) => {
    if (!token) return;
    try {
      await api.decideBooking(bookingId, accept ? "BESTAETIGT" : "ABGELEHNT", token);
      await loadData();
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

  const closeRatingForm = () => {
    setShowRatingForm(false);
    setRatingScore(0);
    setRatingComment("");
  };

  const submitRating = async () => {
    if (!token || !selectedBooking || ratingScore < 1) return;
    setIsSubmittingRating(true);
    try {
      await api.createRating(
        {
          bookingId: selectedBooking.id,
          score: ratingScore,
          comment: ratingComment.trim() || undefined
        },
        token
      );
      closeRatingForm();
      await loadData();
      pushToast("Bewertung gespeichert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Bewertung konnte nicht gespeichert werden.", "error");
    } finally {
      setIsSubmittingRating(false);
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
      return;
    }
    const counterpartId = selectedBooking.providerId === currentUser.id ? selectedBooking.requesterId : selectedBooking.providerId;
    const conversationContext = buildConversationContext(
      selectedBooking,
      currentUser.id,
      ratingsByBookingId.get(selectedBooking.id)
    );

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
      {(!isMobileInbox || !selectedBooking) && (
        <header className="inbox-messenger-title-row">
          <h1>Nachrichten</h1>
          {isLoading && <span className="inbox-loading-hint">Laden…</span>}
        </header>
      )}

      {sortedRows.length === 0 ? (
        <Surface title="Keine Konversationen">
          <EmptyState title="Noch nichts hier" text="Sobald jemand eine Ausleihe anfragt oder du eine sendest, erscheint die Unterhaltung hier." />
        </Surface>
      ) : (
        <div
          className={`messenger-shell${isMobileInbox && selectedBooking ? " messenger-shell--chat-open" : ""}`}
        >
          <InboxThreadList
            sortedRows={sortedRows}
            selectedBookingId={selectedBooking?.id ?? null}
            currentUser={currentUser}
            ratingsByBookingId={ratingsByBookingId}
            readMessageIds={readMessageIds}
            threadHasUnread={threadHasUnread}
            threadButtonRefs={threadButtonRefs}
            onSelectThread={(booking) => {
              if (isMobileInbox) {
                mobileThreadToRestoreRef.current = booking.id;
                shouldFocusMobileChatRef.current = true;
              }
              setSelectedBookingId(booking.id);
              if (booking.type !== "SYSTEM_WARNING") {
                markThreadRead(booking);
              }
            }}
          />

          {selectedBooking && (
            <div className="messenger-chat">
              <header
                className={`messenger-chat-header${isMobileInbox ? " messenger-chat-header--compact" : ""}`}
              >
                {isMobileInbox && (
                  <button
                    ref={mobileBackButtonRef}
                    type="button"
                    className="icon-button messenger-back-button"
                    aria-label="Zurück zur Chatliste"
                    onClick={() => {
                      shouldFocusMobileChatRef.current = false;
                      setSelectedBookingId(null);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      arrow_back
                    </span>
                  </button>
                )}
                <UserAvatar
                  name={counterparty(selectedBooking, currentUser.id).name}
                  imageUrl={null}
                  size="lg"
                />
                <div className="messenger-chat-header-text">
                  <strong>{getChatHeaderTitle(selectedBooking, currentUser.id, isMobileInbox)}</strong>
                  <span className="messenger-chat-header-sub">
                    {getChatHeaderSubtitle(selectedBooking, currentUser.id, isMobileInbox)}
                  </span>
                </div>
                <div className="messenger-chat-header-actions">
                  {!isMobileInbox && (
                    <StatusPill
                      label={
                        selectedBooking.type === "SYSTEM_WARNING"
                          ? getSystemWarningLabel(selectedBooking.systemWarningText)
                          : bookingStatusLabel[selectedBooking.status]
                      }
                      tone={
                        selectedBooking.type === "SYSTEM_WARNING"
                          ? selectedBooking.systemWarningText?.startsWith("ERMAHNUNG:") ||
                            selectedBooking.systemWarningText?.startsWith("SPERRUNG:")
                            ? "danger"
                            : "neutral"
                          : selectedBooking.status === "BESTAETIGT" || selectedBooking.status === "ABGESCHLOSSEN"
                            ? "success"
                            : selectedBooking.status === "ABGELEHNT"
                              ? "danger"
                              : "neutral"
                      }
                    />
                  )}
                  {selectedBooking.type !== "SYSTEM_WARNING" && (
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
                  )}
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

              {showRatingForm && selectedBooking && (
                <RatingFormPanel
                  title="Bewertung abgeben"
                  hint="Deine Bewertung hilft anderen Nutzern bei der Entscheidung."
                  targetLabel={selectedBooking.toolName ?? bookingTypeLabel[selectedBooking.type]}
                  score={ratingScore}
                  comment={ratingComment}
                  isSubmitting={isSubmittingRating}
                  onScoreChange={setRatingScore}
                  onCommentChange={setRatingComment}
                  onSubmit={() => void submitRating()}
                  onCancel={closeRatingForm}
                />
              )}

              <div className="messenger-chat-scroll" ref={chatScrollRef}>
                {selectedBooking.type === "SYSTEM_WARNING" ? (
                  <MessengerRow
                    variant="incoming"
                    avatar={<UserAvatar name={selectedBooking.providerName ?? "System"} imageUrl={null} size="sm" />}
                  >
                    {selectedBooking.systemWarningText?.startsWith("ERMAHNUNG:") ? (
                    <RequestMessageCard
                      label="Sicherheitsmeldung"
                      title="Ermahnung der Moderation"
                      icon="gavel"
                    >
                      {(() => {
                        const parsed = parseWarningMessage(selectedBooking.systemWarningText ?? "");
                        return (
                          <div className="warning-card-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>Grund der Ermahnung:</p>
                            <blockquote style={{ margin: '0 0 12px 0', padding: '8px 12px', borderLeft: '4px solid var(--color-warning)', background: 'rgba(217, 119, 6, 0.08)', fontStyle: 'italic', borderRadius: '0 4px 4px 0' }}>
                              {parsed.reason}
                            </blockquote>
                            {parsed.hint && (
                              <p style={{ margin: 0, fontSize: '0.9em', color: '#dc2626', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2em' }}>warning</span>
                                {parsed.hint}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </RequestMessageCard>
                    ) : selectedBooking.systemWarningText?.startsWith("SPERRUNG:") ? (
                    <RequestMessageCard
                      label="Kontosperrung"
                      title="Dein Konto wurde gesperrt"
                      icon="block"
                    >
                      <div className="warning-card-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>Grund der Sperrung:</p>
                        <blockquote style={{ margin: 0, padding: '8px 12px', borderLeft: '4px solid #dc2626', background: 'rgba(220, 38, 38, 0.08)', fontStyle: 'italic', borderRadius: '0 4px 4px 0' }}>
                          {parseSuspensionMessage(selectedBooking.systemWarningText ?? "").reason}
                        </blockquote>
                        <p style={{ margin: 0, fontSize: '0.9em', color: '#6b7280' }}>
                          Deine Angebote sind vorübergehend ausgeblendet. Nach einer Entsperrung sind sie wieder sichtbar.
                        </p>
                      </div>
                    </RequestMessageCard>
                    ) : (
                    <RequestMessageCard
                      label="Benachrichtigung"
                      title="System-Benachrichtigung"
                      icon="info"
                    >
                      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ margin: 0 }}>{selectedBooking.systemWarningText}</p>
                      </div>
                    </RequestMessageCard>
                    )}
                  </MessengerRow>
                ) : (
                  <>
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

                {selectedBooking.pickupProposals.map((proposal: PickupProposal) => {
                  const fromOtherUser = proposal.proposedById !== currentUser.id;
                  const key = proposalMessageKey(selectedBooking.id, proposal.id);
                  return (
                    <MessengerRow
                      key={proposal.id}
                      variant={fromOtherUser ? "incoming" : "outgoing"}
                      avatar={
                        <UserAvatar
                          name={fromOtherUser ? counterparty(selectedBooking, currentUser.id).name : currentUser.name}
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
                        unread={fromOtherUser && proposal.status === "PENDING" && !readMessageIds.has(key)}
                        onClick={fromOtherUser ? () => markIncomingRead(key) : undefined}
                      />
                    </MessengerRow>
                  );
                })}

                {selectedBooking.timeslotProposals.map((proposal: TimeslotProposal) => {
                  const fromOtherUser = proposal.proposedById !== currentUser.id;
                  const key = proposalMessageKey(selectedBooking.id, proposal.id);
                  return (
                    <MessengerRow
                      key={proposal.id}
                      variant={fromOtherUser ? "incoming" : "outgoing"}
                      avatar={
                        <UserAvatar
                          name={fromOtherUser ? counterparty(selectedBooking, currentUser.id).name : currentUser.name}
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
                        unread={fromOtherUser && proposal.status === "PENDING" && !readMessageIds.has(key)}
                        onClick={fromOtherUser ? () => markIncomingRead(key) : undefined}
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

                {selectedBookingRating && selectedBookingRating.status === "SICHTBAR" && (
                  <MessengerRow
                    variant={selectedBookingRating.fromUserId === currentUser.id ? "outgoing" : "incoming"}
                    avatar={
                      <UserAvatar
                        name={
                          selectedBookingRating.fromUserId === currentUser.id
                            ? currentUser.name
                            : (selectedBookingRating.fromUserName ?? counterparty(selectedBooking, currentUser.id).name)
                        }
                        imageUrl={null}
                        size="sm"
                      />
                    }
                  >
                    <RequestMessageCard
                      label="Bewertung"
                      title={`${selectedBookingRating.score} von 5 Sternen`}
                      icon="star"
                      unread={
                        selectedBookingRating.toUserId === currentUser.id &&
                        !readMessageIds.has(ratingMessageKey(selectedBooking.id, selectedBookingRating.id))
                      }
                      onClick={
                        selectedBookingRating.toUserId === currentUser.id
                          ? () => markIncomingRead(ratingMessageKey(selectedBooking.id, selectedBookingRating.id))
                          : undefined
                      }
                    >
                      <div className="inbox-rating-message">
                        <StarRatingDisplay score={selectedBookingRating.score} />
                        {selectedBookingRating.comment && (
                          <p className="inbox-rating-message-comment">{selectedBookingRating.comment}</p>
                        )}
                      </div>
                    </RequestMessageCard>
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
                          <div className="booking-field">
                            <span>Abholdatum</span>
                            <DateInput
                              aria-label="Alternatives Abholdatum"
                              value={counterDraft?.pickupDate ?? ""}
                              onChange={(value) =>
                                setDraftPickupByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toToolRangeDraft(selectedBooking)),
                                    pickupDate: value
                                  }
                                }))
                              }
                            />
                          </div>
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
                          <div className="booking-field">
                            <span>Rückgabedatum</span>
                            <DateInput
                              aria-label="Alternatives Rückgabedatum"
                              value={counterDraft?.returnDate ?? ""}
                              onChange={(value) =>
                                setDraftPickupByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toToolRangeDraft(selectedBooking)),
                                    returnDate: value
                                  }
                                }))
                              }
                            />
                          </div>
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
                          <div className="booking-field">
                            <span>Startdatum</span>
                            <DateInput
                              aria-label="Alternativdatum für Werkstattvorschlag"
                              value={workshopRangeDraft?.startDate ?? ""}
                              onChange={(value) =>
                                setDraftWorkshopRangeByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toWorkshopDraft(selectedBooking)),
                                    startDate: value
                                  }
                                }))
                              }
                            />
                          </div>
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
                          <div className="booking-field">
                            <span>Enddatum</span>
                            <DateInput
                              aria-label="Alternativ-Enddatum für Werkstattvorschlag"
                              value={workshopRangeDraft?.endDate ?? ""}
                              onChange={(value) =>
                                setDraftWorkshopRangeByBooking((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? toWorkshopDraft(selectedBooking)),
                                    endDate: value
                                  }
                                }))
                              }
                            />
                          </div>
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
                  </>
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

              {canProviderCompleteBooking(selectedBooking, currentUser.id) && (
                <footer className="messenger-chat-footer messenger-chat-footer--completion">
                  <button type="button" onClick={() => void close(selectedBooking.id)}>
                    Als abgeschlossen markieren
                  </button>
                </footer>
              )}

              {showRatingFooter && (
                <footer className="messenger-chat-footer messenger-chat-footer--rating">
                  <p className="inbox-rating-hint">Wie war deine Erfahrung? Du kannst jederzeit bewerten.</p>
                  <button type="button" className="btn" onClick={() => setShowRatingForm(true)}>
                    Bewertung abgeben
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








