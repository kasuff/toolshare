import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, BackHandler, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Spacing, Radius, useThemeColors, createThemedStyleSheet } from '../../constants/theme';
import { ThemedText } from '../../components/ThemedText';
import { api, Booking } from '@toolshare/shared';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState, LoadingSpinner } from '../../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { isInboxSystemNotification, isInboxThreadUnread, countUnreadInboxItems } from '../../utils/inboxUnread';
import { notifyInboxBadgeRefresh } from '../../utils/inboxBadgeEvents';
import { useInboxReadMessages } from '../../hooks/useInboxReadMessages';
import { DateField, TimeField } from '../../components/DateTimeFields';
import {
  combineLocalDateTimeToIso,
  DraftToolRangeParts,
  DraftWorkshopRangeParts,
  getPendingPickupProposal,
  getPendingTimeslotProposal,
  toToolRangeDraft,
  toWorkshopDraft,
} from '../../utils/inboxProposals';
import { parseLocalDateKey } from '../../utils/dateTime';
import { ReportForm } from '../../components/ReportForm';
import { getErrorMessage } from '../../utils/errors';

interface ParsedWarning {
  reason: string;
  moderator: string;
  hint: string;
}

function parseSuspensionMessage(message: string): { reason: string } {
  if (!message.startsWith("SPERRUNG:")) {
    return { reason: message };
  }
  const content = message.replace("SPERRUNG:", "").trim();
  const reasonLine = content.split("\n").find((line) => line.trim().startsWith("Grund:"));
  return {
    reason: reasonLine ? reasonLine.replace("Grund:", "").trim() : content
  };
}

function parseWarningMessage(message: string): ParsedWarning {
  if (!message.startsWith("ERMAHNUNG:")) {
    return { reason: message, moderator: "Moderator", hint: "" };
  }
  const content = message.replace("ERMAHNUNG:", "").trim();
  const lines = content.split("\n");
  let reason = "";
  let moderator = "Moderator";
  let hint = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Moderator:")) {
      moderator = trimmed.replace("Moderator:", "").trim();
    } else if (trimmed.startsWith("Hinweis:")) {
      hint = trimmed;
    } else if (trimmed) {
      if (reason) reason += "\n" + trimmed;
      else reason = trimmed;
    }
  }
  return { reason, moderator, hint };
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]?.toUpperCase()).join('');
}

function formatDateShort(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

function formatDateTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLastActivityMs(booking: Booking): number {
  const createdMs = booking.createdIso ? new Date(booking.createdIso).getTime() : 0;
  let latest = Number.isNaN(createdMs) ? 0 : createdMs;
  for (const proposal of booking.pickupProposals ?? []) {
    const ms = new Date(proposal.createdIso).getTime();
    if (!Number.isNaN(ms)) latest = Math.max(latest, ms);
  }
  for (const proposal of booking.timeslotProposals ?? []) {
    const ms = new Date(proposal.createdIso).getTime();
    if (!Number.isNaN(ms)) latest = Math.max(latest, ms);
  }
  return latest;
}

function proposalStatusLabel(status: 'PENDING' | 'ACCEPTED' | 'DECLINED') {
  if (status === 'ACCEPTED') return 'Angenommen';
  if (status === 'DECLINED') return 'Abgelehnt';
  return 'Warte auf Antwort';
}

function getBubbleMetaLabel(booking: Booking, currentUserId: string) {
  const isRequester = booking.requesterId === currentUserId;
  return isRequester ? 'Du' : (booking.requesterName || 'Anfragende Person');
}

export default function InboxScreen() {
  const { token, currentUser } = useAuth();
  const colors = useThemeColors();
  const Colors = colors;
  const styles = useStyles();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [pickupDraft, setPickupDraft] = useState<DraftToolRangeParts | null>(null);
  const [workshopDraft, setWorkshopDraft] = useState<DraftWorkshopRangeParts | null>(null);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const { readIds, markThreadRead, isStorageLoaded } = useInboxReadMessages(bookings, isLoading);
  
  // Report states
  const [reportTargetUserId, setReportTargetUserId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!token || !currentUser?.id) return;
    try {
      setLoadError(null);
      const bookingsData = await api.getBookingsForUser(token);
      const notificationsData = await api.getNotifications(token);
      
      const systemNotifications = notificationsData
        .filter(n => isInboxSystemNotification(n.message))
        .map(n => {
          const isWarning = n.message.startsWith("ERMAHNUNG:");
          const isSuspension = n.message.startsWith("SPERRUNG:");
          const parsed = isWarning
            ? parseWarningMessage(n.message)
            : isSuspension
              ? { reason: parseSuspensionMessage(n.message).reason, moderator: "Administration", hint: "" }
              : { reason: n.message, moderator: "System", hint: "" };
          return {
            id: n.id,
            type: "SYSTEM_WARNING" as const,
            requesterId: currentUser.id,
            providerId: "system",
            status: "BESTAETIGT" as const,
            createdIso: n.createdIso,
            providerName: parsed.moderator,
            requesterName: currentUser.name ?? "Du",
            toolName: isWarning ? "Ermahnung der Moderation" : isSuspension ? "Kontosperrung" : "System-Benachrichtigung",
            pickupProposals: [],
            timeslotProposals: [],
            selectedWorkshopTools: [],
            systemWarningText: n.message,
            isNotificationRead: n.read
          } as Booking;
        });

      const combined = [...bookingsData, ...systemNotifications];
      combined.sort((a, b) => getLastActivityMs(b) - getLastActivityMs(a));
      
      setBookings(combined);
      setSelectedBooking((prev) => (prev ? combined.find((b) => b.id === prev.id) ?? prev : null));
      const unreadCount = await countUnreadInboxItems(bookingsData, notificationsData, currentUser.id);
      notifyInboxBadgeRefresh(unreadCount);
    } catch (e) {
      console.error(e);
      setLoadError(getErrorMessage(e, 'Nachrichten konnten nicht geladen werden.'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.name, token]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
      const intervalId = setInterval(() => {
        void loadBookings();
      }, 20_000);

      return () => clearInterval(intervalId);
    }, [loadBookings])
  );

  useEffect(() => {
    if (!selectedBooking || selectedBooking.type === 'SYSTEM_WARNING') return;
    if (selectedBooking.type === 'TOOL') {
      setPickupDraft(toToolRangeDraft(selectedBooking));
    } else if (selectedBooking.type === 'WORKSHOP') {
      setWorkshopDraft(toWorkshopDraft(selectedBooking));
    }
  }, [
    selectedBooking?.id,
    selectedBooking?.pickupProposals?.length,
    selectedBooking?.timeslotProposals?.length,
    selectedBooking?.pickupTimeIso,
    selectedBooking?.startIso,
    selectedBooking?.endIso,
    selectedBooking,
  ]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!selectedBooking) {
          return false;
        }
        setSelectedBooking(null);
        return true;
      });
      return () => subscription.remove();
    }, [selectedBooking])
  );

  const handleSelectBooking = async (booking: Booking) => {
    setSelectedBooking(booking);
    setShowCounterForm(false);
    if (booking.type === 'SYSTEM_WARNING') {
      setPickupDraft(null);
      setWorkshopDraft(null);
    } else if (booking.type === 'TOOL') {
      setPickupDraft(toToolRangeDraft(booking));
      setWorkshopDraft(null);
    } else if (booking.type === 'WORKSHOP') {
      setWorkshopDraft(toWorkshopDraft(booking));
      setPickupDraft(null);
    }
    if (booking.type === 'SYSTEM_WARNING' && !booking.isNotificationRead) {
      try {
        await api.markNotificationAsRead(booking.id, token!);
        setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, isNotificationRead: true } : b));
        notifyInboxBadgeRefresh();
      } catch (e) {
        console.error('Fehler beim Markieren als gelesen:', e);
      }
    } else {
      await markThreadRead(booking);
    }
  };

  const openCounterForm = () => {
    if (!selectedBooking) return;
    if (selectedBooking.type === 'TOOL') {
      setPickupDraft(toToolRangeDraft(selectedBooking));
    } else if (selectedBooking.type === 'WORKSHOP') {
      setWorkshopDraft(toWorkshopDraft(selectedBooking));
    }
    setShowCounterForm(true);
  };

  const sendPickupCounterProposal = async () => {
    if (!token || !selectedBooking || !pickupDraft) return;
    if (selectedBooking.type !== 'TOOL' || !selectedBooking.pickupTimeIso) {
      Alert.alert('Fehler', 'Alternativvorschlag ist nur bei Ausleihanfragen mit Abholzeit möglich.');
      return;
    }
    const pickupIso = combineLocalDateTimeToIso(pickupDraft.pickupDate, pickupDraft.pickupTime);
    const returnIso = combineLocalDateTimeToIso(pickupDraft.returnDate, pickupDraft.returnTime);
    if (!pickupIso || !returnIso) {
      Alert.alert('Fehler', 'Bitte Abholung und Rückgabe jeweils mit Datum und Uhrzeit wählen.');
      return;
    }
    if (new Date(returnIso).getTime() <= new Date(pickupIso).getTime()) {
      Alert.alert('Fehler', 'Die Rückgabe muss nach der Abholung liegen.');
      return;
    }
    setIsSubmittingProposal(true);
    try {
      await api.createPickupProposal(selectedBooking.id, pickupIso, returnIso, token);
      await loadBookings();
      setShowCounterForm(false);
      Alert.alert('Gesendet', 'Alternativvorschlag gesendet.');
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Alternativvorschlag konnte nicht gesendet werden.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const sendTimeslotCounterProposal = async () => {
    if (!token || !selectedBooking || !workshopDraft) return;
    if (selectedBooking.type !== 'WORKSHOP') {
      Alert.alert('Fehler', 'Alternativvorschlag ist hier nicht verfügbar.');
      return;
    }
    const startIso = combineLocalDateTimeToIso(workshopDraft.startDate, workshopDraft.startTime);
    const endIso = combineLocalDateTimeToIso(workshopDraft.endDate, workshopDraft.endTime);
    if (!startIso || !endIso) {
      Alert.alert('Fehler', 'Bitte Start- und Enddatum jeweils mit Uhrzeit wählen.');
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      Alert.alert('Fehler', 'Das Ende muss nach dem Start liegen.');
      return;
    }
    setIsSubmittingProposal(true);
    try {
      await api.createTimeslotProposal(selectedBooking.id, startIso, endIso, token);
      await loadBookings();
      setShowCounterForm(false);
      Alert.alert('Gesendet', 'Alternativzeitraum gesendet.');
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Alternativzeitraum konnte nicht gesendet werden.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const acceptLatestCounterProposal = async () => {
    if (!token || !selectedBooking) return;
    const pendingPickup = getPendingPickupProposal(selectedBooking);
    const pendingTimeslot = getPendingTimeslotProposal(selectedBooking);
    setIsSubmittingProposal(true);
    try {
      if (pendingPickup) {
        await api.respondPickupProposal(selectedBooking.id, pendingPickup.id, 'ACCEPT', token);
        Alert.alert('Angenommen', 'Alternativvorschlag angenommen.');
      } else if (pendingTimeslot) {
        await api.respondTimeslotProposal(selectedBooking.id, pendingTimeslot.id, 'ACCEPT', token);
        Alert.alert('Angenommen', 'Alternativzeit angenommen.');
      }
      await loadBookings();
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Vorschlag konnte nicht angenommen werden.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const declineLatestCounterProposal = async () => {
    if (!token || !selectedBooking) return;
    const pendingPickup = getPendingPickupProposal(selectedBooking);
    const pendingTimeslot = getPendingTimeslotProposal(selectedBooking);
    setIsSubmittingProposal(true);
    try {
      if (pendingPickup) {
        await api.respondPickupProposal(selectedBooking.id, pendingPickup.id, 'DECLINE', token);
        Alert.alert('Abgelehnt', 'Alternativvorschlag abgelehnt.');
      } else if (pendingTimeslot) {
        await api.respondTimeslotProposal(selectedBooking.id, pendingTimeslot.id, 'DECLINE', token);
        Alert.alert('Abgelehnt', 'Alternativzeit abgelehnt.');
      }
      await loadBookings();
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Vorschlag konnte nicht abgelehnt werden.');
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleDecide = async (bookingId: string, accept: boolean) => {
    if (!token) return;
    try {
      await api.decideBooking(bookingId, accept ? 'BESTAETIGT' : 'ABGELEHNT', token);
      setShowCounterForm(false);
      await loadBookings();
    } catch (e) {
      console.error(e);
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Status konnte nicht gesetzt werden.');
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim() || !reportTargetUserId || !token) return;
    setIsReporting(true);
    try {
      await api.createReport(
        {
          targetId: reportTargetUserId,
          targetType: 'USER',
          reason: reportReason,
          details: reportDetails,
        },
        token
      );
      Alert.alert('Erfolg', 'Nutzer wurde gemeldet.');
      setReportTargetUserId(null);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      Alert.alert('Fehler', getErrorMessage(err, 'Meldung fehlgeschlagen.'));
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading || !isStorageLoaded) return <LoadingSpinner />;

  if (loadError) {
    return (
      <View style={styles.center}>
        <EmptyState title="Laden fehlgeschlagen" text={loadError} />
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          setIsLoading(true);
          void loadBookings();
        }}>
          <ThemedText style={styles.retryButtonText}>Erneut versuchen</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentUser || !token) {
    return (
      <View style={styles.center}>
        <EmptyState title="Login erforderlich" text="Bitte melde dich an, um dein Postfach zu sehen." />
      </View>
    );
  }

  // --- Detail Chat View ---
  if (selectedBooking) {
    const isSystemWarning = selectedBooking.type === 'SYSTEM_WARNING';
    const isOwner = selectedBooking.providerId === currentUser.id;
    const counterpartName = isSystemWarning ? selectedBooking.providerName : (isOwner ? selectedBooking.requesterName : selectedBooking.providerName);
    const isPending = selectedBooking.status === 'OFFEN';
    const pendingPickupProposal = selectedBooking.type === 'TOOL' ? getPendingPickupProposal(selectedBooking) : null;
    const pendingTimeslotProposal = selectedBooking.type === 'WORKSHOP' ? getPendingTimeslotProposal(selectedBooking) : null;
    const canRespondToPickupCounter = Boolean(
      pendingPickupProposal && pendingPickupProposal.proposedById !== currentUser.id
    );
    const canRespondToTimeslotCounter = Boolean(
      pendingTimeslotProposal && pendingTimeslotProposal.proposedById !== currentUser.id
    );
    const showProviderActions =
      isPending && isOwner && !pendingPickupProposal && !pendingTimeslotProposal && !isSystemWarning;
    const showCounterResponseActions =
      isPending &&
      !showCounterForm &&
      (canRespondToPickupCounter || canRespondToTimeslotCounter) &&
      !isSystemWarning;

    return (
      <View style={styles.container}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => { setSelectedBooking(null); setShowCounterForm(false); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <ThemedText type="defaultSemiBold" style={{fontSize: 16}}>{counterpartName || 'Unbekannt'}</ThemedText>
            <ThemedText type="muted" style={{fontSize: 12}}>
              {selectedBooking.toolName || (selectedBooking.type === 'WORKSHOP' ? 'Werkstatt' : 'Werkzeug')}
            </ThemedText>
          </View>
          {isSystemWarning ? (
            <View style={[styles.statusBadge, { backgroundColor: selectedBooking.systemWarningText?.startsWith("SPERRUNG:") ? Colors.danger : Colors.warning }]}>
              <ThemedText style={styles.statusText}>
                {selectedBooking.systemWarningText?.startsWith("SPERRUNG:") ? 'Gesperrt' : 'Meldung'}
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: selectedBooking.status === 'BESTAETIGT' ? Colors.success : selectedBooking.status === 'ABGELEHNT' ? Colors.danger : Colors.border }]}>
              <ThemedText style={styles.statusText}>
                {selectedBooking.status === 'OFFEN' ? 'Offen' : selectedBooking.status === 'BESTAETIGT' ? 'Bestätigt' : selectedBooking.status === 'ABGELEHNT' ? 'Abgelehnt' : 'Abgeschlossen'}
              </ThemedText>
            </View>
          )}
          
          {!isSystemWarning && counterpartName && (
            <View style={{ zIndex: 10, position: 'relative' }}>
              <TouchableOpacity 
                style={{ marginLeft: Spacing.sm, paddingHorizontal: Spacing.xs }} 
                onPress={() => setShowMenu(!showMenu)}
              >
                <Ionicons name="ellipsis-vertical" size={24} color={Colors.text} />
              </TouchableOpacity>
              
              {showMenu && (
                <>
                  <Pressable 
                    style={{
                      position: 'absolute',
                      top: -100,
                      bottom: -1000,
                      left: -1000,
                      right: -100,
                      zIndex: 9,
                    }}
                    onPress={() => setShowMenu(false)}
                  />
                  <View 
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 30,
                      backgroundColor: Colors.surface,
                      borderRadius: Radius.md,
                      padding: Spacing.xs,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      elevation: 5,
                      minWidth: 140,
                      zIndex: 10,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        paddingVertical: Spacing.sm,
                        paddingHorizontal: Spacing.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: Spacing.xs,
                      }}
                      onPress={() => {
                        setShowMenu(false);
                        setReportTargetUserId(isOwner ? selectedBooking.requesterId : selectedBooking.providerId);
                      }}
                    >
                      <Ionicons name="warning-outline" size={16} color={Colors.danger} />
                      <ThemedText style={{ color: Colors.danger, fontSize: 14 }}>Nutzer melden</ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* Chat History */}
        <ScrollView style={styles.chatScroll} contentContainerStyle={{ padding: Spacing.md }}>
          {isSystemWarning ? (
            <View style={styles.messageBubble}>
              {selectedBooking.systemWarningText?.startsWith("ERMAHNUNG:") ? (
                (() => {
                  const parsed = parseWarningMessage(selectedBooking.systemWarningText ?? "");
                  return (
                    <View style={styles.warningContainer}>
                      <View style={styles.messageIconRow}>
                        <Ionicons name="alert-circle-outline" size={24} color={Colors.warning} />
                        <ThemedText type="defaultSemiBold" style={[styles.warningTitle, {color: Colors.warning}]}>
                          Ermahnung der Moderation
                        </ThemedText>
                      </View>
                      <ThemedText type="defaultSemiBold" style={{fontSize: 14, marginBottom: 4}}>Grund der Ermahnung:</ThemedText>
                      <View style={styles.warningQuote}>
                        <ThemedText style={styles.quoteText}>{parsed.reason}</ThemedText>
                      </View>
                      {parsed.hint ? (
                        <View style={styles.hintContainer}>
                          <Ionicons name="warning-outline" size={16} color="#DC2626" />
                          <ThemedText style={styles.hintTextDanger}>{parsed.hint}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  );
                })()
              ) : selectedBooking.systemWarningText?.startsWith("SPERRUNG:") ? (
                <View style={styles.suspensionContainer}>
                  <View style={styles.messageIconRow}>
                    <Ionicons name="ban-outline" size={24} color="#DC2626" />
                    <ThemedText type="defaultSemiBold" style={[styles.warningTitle, {color: '#DC2626'}]}>
                      Dein Konto wurde gesperrt
                    </ThemedText>
                  </View>
                  <ThemedText type="defaultSemiBold" style={{fontSize: 14, marginBottom: 4}}>Grund der Sperrung:</ThemedText>
                  <View style={styles.suspensionQuote}>
                    <ThemedText style={styles.quoteText}>{parseSuspensionMessage(selectedBooking.systemWarningText ?? "").reason}</ThemedText>
                  </View>
                  <ThemedText type="muted" style={{fontSize: 13, marginTop: Spacing.sm}}>
                    Deine Angebote sind vorübergehend ausgeblendet. Nach einer Entsperrung sind sie wieder sichtbar.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.systemMessageContainer}>
                  <View style={styles.messageIconRow}>
                    <Ionicons name="information-circle-outline" size={24} color={Colors.brand} />
                    <ThemedText type="defaultSemiBold" style={styles.warningTitle}>
                      System-Benachrichtigung
                    </ThemedText>
                  </View>
                  <ThemedText style={{fontSize: 14}}>{selectedBooking.systemWarningText}</ThemedText>
                </View>
              )}
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.chatMessageRow,
                  selectedBooking.requesterId === currentUser.id
                    ? styles.chatMessageRowOutgoing
                    : styles.chatMessageRowIncoming,
                ]}
              >
                {selectedBooking.requesterId !== currentUser.id && (
                  <View style={[styles.msgAvatar, styles.msgAvatarIncoming]}>
                    <ThemedText style={styles.msgAvatarText}>{getInitials(counterpartName || 'Kontakt') || 'K'}</ThemedText>
                  </View>
                )}
                <View
                  style={
                    selectedBooking.requesterId === currentUser.id
                      ? styles.messageMetaWrapOutgoing
                      : styles.messageMetaWrapIncoming
                  }
                >
                  <ThemedText type="muted" style={styles.messageMeta}>
                    {getBubbleMetaLabel(selectedBooking, currentUser.id)} · {formatDateTime(selectedBooking.createdIso)}
                  </ThemedText>
                  <View
                    style={[
                      styles.messageBubble,
                      selectedBooking.requesterId === currentUser.id ? styles.outgoingBubble : styles.incomingBubble,
                    ]}
                  >
                    <View style={styles.messageIconRow}>
                      <Ionicons name={selectedBooking.type === 'WORKSHOP' ? 'home-outline' : 'hammer-outline'} size={20} color={Colors.brand} />
                      <ThemedText type="defaultSemiBold" style={{marginLeft: Spacing.xs}}>Buchungsanfrage</ThemedText>
                    </View>
                    <View style={styles.messageDetailRow}>
                      <ThemedText type="muted">{selectedBooking.type === 'WORKSHOP' ? 'Von:' : 'Abholung:'}</ThemedText>
                      <ThemedText>{formatDateTime((selectedBooking.type === 'WORKSHOP' ? selectedBooking.startIso : selectedBooking.pickupTimeIso) || '')}</ThemedText>
                    </View>
                    <View style={styles.messageDetailRow}>
                      <ThemedText type="muted">{selectedBooking.type === 'WORKSHOP' ? 'Bis:' : 'Rückgabe:'}</ThemedText>
                      <ThemedText>{formatDateTime(selectedBooking.endIso || '')}</ThemedText>
                    </View>
                  </View>
                </View>
                {selectedBooking.requesterId === currentUser.id && (
                  <View style={[styles.msgAvatar, styles.msgAvatarOutgoing]}>
                    <ThemedText style={styles.msgAvatarText}>{getInitials(currentUser.name || 'Du') || 'D'}</ThemedText>
                  </View>
                )}
              </View>

              {(selectedBooking.pickupProposals ?? []).map((proposal) => {
                const fromOtherUser = proposal.proposedById !== currentUser.id;
                const senderName = fromOtherUser
                  ? (counterpartName || 'Kontakt')
                  : (currentUser.name || 'Du');
                return (
                  <View
                    key={proposal.id}
                    style={[
                      styles.chatMessageRow,
                      fromOtherUser ? styles.chatMessageRowIncoming : styles.chatMessageRowOutgoing,
                    ]}
                  >
                    {fromOtherUser && (
                      <View style={[styles.msgAvatar, styles.msgAvatarIncoming]}>
                        <ThemedText style={styles.msgAvatarText}>{getInitials(senderName) || 'K'}</ThemedText>
                      </View>
                    )}
                    <View style={fromOtherUser ? styles.messageMetaWrapIncoming : styles.messageMetaWrapOutgoing}>
                      <ThemedText type="muted" style={styles.messageMeta}>
                        {fromOtherUser ? senderName : 'Du'} · {formatDateTime(proposal.createdIso)}
                      </ThemedText>
                      <View style={[styles.messageBubble, fromOtherUser ? styles.incomingBubble : styles.outgoingBubble]}>
                        <View style={styles.messageIconRow}>
                          <Ionicons name="swap-horizontal-outline" size={20} color={Colors.brand} />
                          <ThemedText type="defaultSemiBold" style={{marginLeft: Spacing.xs}}>
                            Alternativvorschlag · {proposalStatusLabel(proposal.status)}
                          </ThemedText>
                        </View>
                        <View style={styles.messageDetailRow}>
                          <ThemedText type="muted">Abholung:</ThemedText>
                          <ThemedText>{formatDateTime(proposal.proposedPickupIso)}</ThemedText>
                        </View>
                        <View style={styles.messageDetailRow}>
                          <ThemedText type="muted">Rückgabe:</ThemedText>
                          <ThemedText>{formatDateTime(proposal.proposedReturnIso || selectedBooking.endIso || '')}</ThemedText>
                        </View>
                      </View>
                    </View>
                    {!fromOtherUser && (
                      <View style={[styles.msgAvatar, styles.msgAvatarOutgoing]}>
                        <ThemedText style={styles.msgAvatarText}>{getInitials(currentUser.name || 'Du') || 'D'}</ThemedText>
                      </View>
                    )}
                  </View>
                );
              })}

              {(selectedBooking.timeslotProposals ?? []).map((proposal) => {
                const fromOtherUser = proposal.proposedById !== currentUser.id;
                const senderName = fromOtherUser
                  ? (counterpartName || 'Kontakt')
                  : (currentUser.name || 'Du');
                return (
                  <View
                    key={proposal.id}
                    style={[
                      styles.chatMessageRow,
                      fromOtherUser ? styles.chatMessageRowIncoming : styles.chatMessageRowOutgoing,
                    ]}
                  >
                    {fromOtherUser && (
                      <View style={[styles.msgAvatar, styles.msgAvatarIncoming]}>
                        <ThemedText style={styles.msgAvatarText}>{getInitials(senderName) || 'K'}</ThemedText>
                      </View>
                    )}
                    <View style={fromOtherUser ? styles.messageMetaWrapIncoming : styles.messageMetaWrapOutgoing}>
                      <ThemedText type="muted" style={styles.messageMeta}>
                        {fromOtherUser ? senderName : 'Du'} · {formatDateTime(proposal.createdIso)}
                      </ThemedText>
                      <View style={[styles.messageBubble, fromOtherUser ? styles.incomingBubble : styles.outgoingBubble]}>
                        <View style={styles.messageIconRow}>
                          <Ionicons name="swap-horizontal-outline" size={20} color={Colors.brand} />
                          <ThemedText type="defaultSemiBold" style={{marginLeft: Spacing.xs}}>
                            Alternativzeit · {proposalStatusLabel(proposal.status)}
                          </ThemedText>
                        </View>
                        <View style={styles.messageDetailRow}>
                          <ThemedText type="muted">Von:</ThemedText>
                          <ThemedText>{formatDateTime(proposal.proposedStartIso)}</ThemedText>
                        </View>
                        <View style={styles.messageDetailRow}>
                          <ThemedText type="muted">Bis:</ThemedText>
                          <ThemedText>{formatDateTime(proposal.proposedEndIso)}</ThemedText>
                        </View>
                      </View>
                    </View>
                    {!fromOtherUser && (
                      <View style={[styles.msgAvatar, styles.msgAvatarOutgoing]}>
                        <ThemedText style={styles.msgAvatarText}>{getInitials(currentUser.name || 'Du') || 'D'}</ThemedText>
                      </View>
                    )}
                  </View>
                );
              })}

              {selectedBooking.status !== 'OFFEN' && (
                <View style={styles.systemEventWrap}>
                  <View style={[
                    styles.messageBubble,
                    styles.statusBubble,
                    selectedBooking.status === 'ABGELEHNT' && { borderColor: Colors.danger }
                  ]}>
                    <View style={[styles.messageIconRow, { justifyContent: 'center', marginBottom: 0 }]}>
                      <Ionicons
                        name={
                          selectedBooking.status === 'BESTAETIGT'
                            ? 'checkmark-circle-outline'
                            : selectedBooking.status === 'ABGELEHNT'
                              ? 'close-circle-outline'
                              : 'checkmark-done-circle-outline'
                        }
                        size={20}
                        color={selectedBooking.status === 'ABGELEHNT' ? Colors.danger : Colors.success}
                      />
                      <ThemedText type="defaultSemiBold" style={{
                        marginLeft: Spacing.xs,
                        color: selectedBooking.status === 'ABGELEHNT' ? Colors.danger : Colors.success
                      }}>
                        {selectedBooking.status === 'BESTAETIGT'
                          ? 'Anfrage angenommen'
                          : selectedBooking.status === 'ABGELEHNT'
                            ? 'Anfrage abgelehnt'
                            : 'Buchung abgeschlossen'}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}

          {showCounterForm && !isSystemWarning && (
            <View style={[styles.messageBubble, styles.counterFormBubble]}>
              <View style={styles.messageIconRow}>
                <Ionicons name="swap-horizontal-outline" size={20} color={Colors.brand} />
                <ThemedText type="defaultSemiBold" style={{ marginLeft: Spacing.xs }}>
                  Alternativvorschlag
                </ThemedText>
              </View>

              {selectedBooking.type === 'TOOL' && pickupDraft ? (
                <>
                  <View style={styles.formRow}>
                    <DateField
                      label="Abholdatum"
                      value={pickupDraft.pickupDate}
                      onChange={(value) => setPickupDraft({ ...pickupDraft, pickupDate: value })}
                    />
                    <TimeField
                      label="Abholzeit"
                      value={pickupDraft.pickupTime}
                      onChange={(value) => setPickupDraft({ ...pickupDraft, pickupTime: value })}
                      baseDate={pickupDraft.pickupDate}
                    />
                  </View>
                  <View style={styles.formRow}>
                    <DateField
                      label="Rückgabedatum"
                      value={pickupDraft.returnDate}
                      onChange={(value) => setPickupDraft({ ...pickupDraft, returnDate: value })}
                      minimumDate={parseLocalDateKey(pickupDraft.pickupDate) ?? undefined}
                    />
                    <TimeField
                      label="Rückgabezeit"
                      value={pickupDraft.returnTime}
                      onChange={(value) => setPickupDraft({ ...pickupDraft, returnTime: value })}
                      baseDate={pickupDraft.returnDate}
                    />
                  </View>
                </>
              ) : workshopDraft ? (
                <>
                  <View style={styles.formRow}>
                    <DateField
                      label="Startdatum"
                      value={workshopDraft.startDate}
                      onChange={(value) => setWorkshopDraft({ ...workshopDraft, startDate: value })}
                    />
                    <TimeField
                      label="Startzeit"
                      value={workshopDraft.startTime}
                      onChange={(value) => setWorkshopDraft({ ...workshopDraft, startTime: value })}
                      baseDate={workshopDraft.startDate}
                    />
                  </View>
                  <View style={styles.formRow}>
                    <DateField
                      label="Enddatum"
                      value={workshopDraft.endDate}
                      onChange={(value) => setWorkshopDraft({ ...workshopDraft, endDate: value })}
                      minimumDate={parseLocalDateKey(workshopDraft.startDate) ?? undefined}
                    />
                    <TimeField
                      label="Endzeit"
                      value={workshopDraft.endTime}
                      onChange={(value) => setWorkshopDraft({ ...workshopDraft, endTime: value })}
                      baseDate={workshopDraft.endDate}
                    />
                  </View>
                </>
              ) : null}

              <View style={styles.counterFormActions}>
                <TouchableOpacity
                  style={styles.counterFormCancelBtn}
                  onPress={() => setShowCounterForm(false)}
                  disabled={isSubmittingProposal}
                >
                  <ThemedText style={styles.counterFormCancelText}>Abbrechen</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.counterFormSendBtn, isSubmittingProposal && styles.actionBtnDisabled]}
                  onPress={() =>
                    void (selectedBooking.type === 'TOOL'
                      ? sendPickupCounterProposal()
                      : sendTimeslotCounterProposal())
                  }
                  disabled={isSubmittingProposal}
                >
                  {isSubmittingProposal ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFF" />
                      <ThemedText style={styles.counterFormSendText}>Senden</ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {showProviderActions && !showCounterForm && (
          <View style={styles.chatFooter}>
            <TouchableOpacity
              style={[styles.footerIconBtn, styles.footerBtnPrimary]}
              onPress={() => handleDecide(selectedBooking.id, true)}
              disabled={isSubmittingProposal}
              accessibilityLabel="Annehmen"
            >
              <Ionicons name="checkmark" size={26} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtnCounter, styles.footerBtnSecondary]}
              onPress={openCounterForm}
              disabled={isSubmittingProposal}
            >
              <ThemedText style={styles.footerBtnSecondaryText} numberOfLines={1}>
                Alternativvorschlag
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerIconBtn, styles.footerBtnGhost]}
              onPress={() => handleDecide(selectedBooking.id, false)}
              disabled={isSubmittingProposal}
              accessibilityLabel="Ablehnen"
            >
              <Ionicons name="close" size={26} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}

        {showCounterResponseActions && (
          <View style={styles.chatFooter}>
            <TouchableOpacity
              style={[styles.footerIconBtn, styles.footerBtnPrimary]}
              onPress={() => void acceptLatestCounterProposal()}
              disabled={isSubmittingProposal}
              accessibilityLabel="Annehmen"
            >
              <Ionicons name="checkmark" size={26} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerBtnCounter, styles.footerBtnSecondary]}
              onPress={openCounterForm}
              disabled={isSubmittingProposal}
            >
              <ThemedText style={styles.footerBtnSecondaryText} numberOfLines={1}>
                Alternativvorschlag
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerIconBtn, styles.footerBtnGhost]}
              onPress={() => void declineLatestCounterProposal()}
              disabled={isSubmittingProposal}
              accessibilityLabel="Ablehnen"
            >
              <Ionicons name="close" size={26} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
        
        <ReportForm
          visible={reportTargetUserId !== null}
          title="Nutzer melden"
          reason={reportReason}
          details={reportDetails}
          isSubmitting={isReporting}
          onReasonChange={setReportReason}
          onDetailsChange={setReportDetails}
          onSubmit={submitReport}
          onCancel={() => setReportTargetUserId(null)}
        />
      </View>
    );
  }

  // --- List View ---
  if (bookings.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState title="Keine Nachrichten" text="Sobald es Anfragen gibt, erscheinen sie hier." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {bookings.map(booking => {
        const isSystemWarning = booking.type === 'SYSTEM_WARNING';
        const isOwner = booking.providerId === currentUser.id;
        const counterpartName = isSystemWarning ? booking.providerName : (isOwner ? booking.requesterName : booking.providerName);
        const toolName = booking.toolName || (booking.type === 'WORKSHOP' ? 'Werkstatt' : 'Werkzeug');
        const isUnreadAction = isInboxThreadUnread(booking, currentUser.id, readIds);

        return (
          <TouchableOpacity 
            key={booking.id} 
            style={[styles.threadItem, isUnreadAction && styles.threadUnread]}
            onPress={() => handleSelectBooking(booking)}
          >
            <View style={[
              styles.avatar, 
              isSystemWarning && { 
                backgroundColor: booking.systemWarningText?.startsWith("SPERRUNG:") ? Colors.danger : Colors.warning 
              }
            ]}>
              <ThemedText style={styles.avatarText}>{getInitials(counterpartName || 'U')}</ThemedText>
            </View>
            <View style={styles.threadContent}>
              <View style={styles.threadTopRow}>
                <ThemedText type="defaultSemiBold" style={{fontSize: 15}}>{counterpartName || 'Unbekannt'}</ThemedText>
                <ThemedText type="muted" style={{fontSize: 12}}>{formatDateShort(booking.createdIso)}</ThemedText>
              </View>
              <ThemedText style={{fontSize: 14, marginTop: 2}} numberOfLines={1}>{toolName}</ThemedText>
              <ThemedText type="muted" style={{fontSize: 13, marginTop: 2}}>
                {isSystemWarning ? 'System-Meldung' : `Status: ${booking.status === 'OFFEN' ? 'Ausstehend' : booking.status === 'BESTAETIGT' ? 'Bestätigt' : booking.status === 'ABGELEHNT' ? 'Abgelehnt' : 'Abgeschlossen'}`}
              </ThemedText>
            </View>
            {isUnreadAction && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: colors.brand,
  },
  retryButtonText: {
    color: colors.surface,
    fontWeight: '600',
  },
  threadItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  threadUnread: {
    backgroundColor: colors.brandSoft,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  threadContent: {
    flex: 1,
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
    marginLeft: Spacing.sm,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatScroll: {
    flex: 1,
  },
  messageBubble: {
    backgroundColor: colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.md,
  },
  incomingBubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  outgoingBubble: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  statusBubble: {
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  chatMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  chatMessageRowIncoming: {
    justifyContent: 'flex-start',
  },
  chatMessageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  msgAvatarIncoming: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: Spacing.xs,
  },
  msgAvatarOutgoing: {
    backgroundColor: colors.brand,
    marginLeft: Spacing.xs,
  },
  msgAvatarText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 11,
  },
  messageMetaWrapIncoming: {
    maxWidth: '84%',
    alignItems: 'flex-start',
  },
  messageMetaWrapOutgoing: {
    maxWidth: '84%',
    alignItems: 'flex-end',
  },
  messageMeta: {
    fontSize: 11,
    marginBottom: 4,
  },
  systemEventWrap: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  messageIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  messageDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 0.48,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  counterFormBubble: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  counterFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  counterFormCancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  counterFormCancelText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  counterFormSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  counterFormSendText: {
    color: '#FFF',
    fontWeight: '700',
  },
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerIconBtn: {
    width: 48,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnCounter: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: {
    backgroundColor: colors.brand,
  },
  footerBtnSecondary: {
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  footerBtnSecondaryText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 12,
  },
  footerBtnGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningContainer: {
    paddingVertical: Spacing.xs,
  },
  warningTitle: {
    fontSize: 18,
    marginLeft: Spacing.xs,
    fontWeight: 'bold',
  },
  warningQuote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    backgroundColor: 'rgba(146, 64, 14, 0.06)',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.sm,
  },
  suspensionQuote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginVertical: Spacing.sm,
  },
  quoteText: {
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: 20,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  hintTextDanger: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: Spacing.xs,
    flex: 1,
  },
  suspensionContainer: {
    paddingVertical: Spacing.xs,
  },
  systemMessageContainer: {
    paddingVertical: Spacing.xs,
  }
}));
