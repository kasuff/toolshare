import { useState, useMemo } from 'react';
import { View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Pressable } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, getPlaceholderImageForCategory, TOOL_CATEGORIES } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { useToolDetail, useToolBlockingPeriods, useToolRatings, toolKeys } from '../../../hooks/queries/tools.queries';
import { inboxKeys } from '../../../hooks/queries/inbox.queries';
import { LoadingSpinner } from '../../../components/EmptyState';
import { useThemeColors, createThemedStyleSheet, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { DateField, TimeField } from '../../../components/DateTimeFields';
import { getDefaultDateRange, parseLocalDateKey, toLocalDateKey } from '../../../utils/dateTime';
import { RatingsSection } from '../../../components/RatingsSection';
import type { PublicRating } from '@toolshare/shared';
import { ReportForm } from '../../../components/ReportForm';
import { ImageLightbox } from '../../../components/ImageLightbox';
import { getErrorMessage } from '../../../utils/errors';

type BlockingPeriod = {
  startIso: string;
  endIso: string;
};

type CalendarDay = {
  key: string;
  day: number | null;
  dateKey?: string;
  available: boolean;
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function overlapsDay(period: BlockingPeriod, date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return new Date(period.startIso) < dayEnd && new Date(period.endIso) > dayStart;
}

function periodsOverlap(startIso: string, endIso: string, periods: BlockingPeriod[]) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return periods.some(
    (period) => new Date(period.startIso) < end && new Date(period.endIso) > start
  );
}

function getCalendarDays(
  monthDate: Date,
  isAvailable: boolean,
  blockingPeriods: BlockingPeriod[]
): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toLocalDateKey(new Date());
  const days: CalendarDay[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    days.push({ key: `empty-${index}`, day: null, available: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = toLocalDateKey(new Date(year, month, day));
    days.push({
      key: dateKey,
      day,
      dateKey,
      available:
        isAvailable &&
        dateKey > today &&
        !blockingPeriods.some((period) => overlapsDay(period, new Date(year, month, day)))
    });
  }

  return days;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ToolDetailScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, currentUser } = useAuth();
  const queryClient = useQueryClient();

  const defaults = useMemo(getDefaultDateRange, []);

  const toolQuery = useToolDetail(id ?? '', token);
  const blockingQuery = useToolBlockingPeriods(id ?? '');
  const ratingsQuery = useToolRatings(id ?? '');
  const tool = toolQuery.data ?? null;
  const blockingPeriods = useMemo<BlockingPeriod[]>(() => blockingQuery.data ?? [], [blockingQuery.data]);
  const ratings: PublicRating[] = ratingsQuery.data ?? [];
  const isLoading = toolQuery.isLoading;

  const [startDate, setStartDate] = useState(defaults.startDate);
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [endTime, setEndTime] = useState("10:00");
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [isSelectingRangeEnd, setIsSelectingRangeEnd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Report states
  const [reportTarget, setReportTarget] = useState<'TOOL' | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const isAvailable = tool?.status === 'VERFUEGBAR';
  const isOwnTool = Boolean(tool && currentUser?.id === tool.ownerId);
  const canChooseDates = isOwnTool || isAvailable;
  const toolImage = tool ? tool.imageUrl || getPlaceholderImageForCategory(tool.category) : '';
  const providerName = tool?.ownerName ?? "Unbekannt";
  const categoryLabel = tool
    ? TOOL_CATEGORIES.find((category) => category.value === tool.category.toLowerCase())?.label ?? tool.category
    : "";

  const calendarMonths = useMemo(() => {
    const firstMonth = new Date();
    firstMonth.setDate(1);
    firstMonth.setMonth(firstMonth.getMonth() + calendarMonthOffset);
    return [0, 1].map((monthIndex) => {
      const monthDate = new Date(firstMonth);
      monthDate.setMonth(monthDate.getMonth() + monthIndex);
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(monthDate),
        days: getCalendarDays(monthDate, canChooseDates, blockingPeriods)
      };
    });
  }, [blockingPeriods, calendarMonthOffset, canChooseDates]);

  const selectCalendarDate = (dateKey: string) => {
    if (!isSelectingRangeEnd || dateKey < startDate) {
      setStartDate(dateKey);
      setEndDate(dateKey);
      setIsSelectingRangeEnd(true);
      return;
    }
    setEndDate(dateKey);
    setIsSelectingRangeEnd(false);
  };

  const validateAndSubmit = async (type: 'BOOK' | 'BLOCK') => {
    setError('');
    setSuccess('');

    if (!startDate || !startTime || !endDate || !endTime) {
      setError("Bitte Daten vollständig ausfüllen.");
      return;
    }

    const startIso = `${startDate}T${startTime}`;
    const endIso = `${endDate}T${endTime}`;

    if (new Date(endIso) <= new Date(startIso)) {
      setError("Das Ende muss nach dem Beginn liegen.");
      return;
    }
    
    if (periodsOverlap(startIso, endIso, blockingPeriods)) {
      setError("Der gewählte Zeitraum überschneidet sich mit belegten Zeiten.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (type === 'BLOCK') {
        await api.createToolOwnerBlock({ toolId: tool!.id, startIso, endIso }, token!);
        setSuccess('Werkzeug wurde erfolgreich blockiert.');
        void queryClient.invalidateQueries({ queryKey: toolKeys.blocking(tool!.id) });
      } else {
        await api.createToolRequest({
          toolId: tool!.id,
          startIso,
          endIso,
          pickupTimeIso: startIso
        }, token!);
        setSuccess('Buchungsanfrage erfolgreich gesendet!');
        void queryClient.invalidateQueries({ queryKey: toolKeys.detail(tool!.id) });
        void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
        setTimeout(() => {
          router.replace('/inbox');
        }, 1500);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Aktion fehlgeschlagen.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    setIsReporting(true);
    try {
      await api.createReport(
        {
          targetId: tool!.id,
          targetType: reportTarget,
          reason: reportReason,
          details: reportDetails,
        },
        token!
      );
      Alert.alert('Erfolg', 'Meldung wurde gesendet.');
      setReportTarget(null);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      Alert.alert('Fehler', getErrorMessage(err, 'Fehler beim Senden der Meldung'));
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!tool) {
    return (
      <View style={styles.center}>
        <ThemedText>Werkzeug nicht gefunden.</ThemedText>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container}>
      {/* Tool Image Header */}
      <View style={styles.imageContainer}>
        <Pressable onPress={() => setPreviewImage(toolImage)} style={{ flex: 1 }}>
          <Image source={{ uri: toolImage }} style={styles.image} />
        </Pressable>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        {isOwnTool && (
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => router.push(`/tools/edit?id=${tool.id}`)}
          >
            <Ionicons name="pencil" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <ThemedText style={styles.categoryText}>{categoryLabel}</ThemedText>
            </View>
          </View>
          <ThemedText type="title" style={styles.title}>{tool.name}</ThemedText>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Details</ThemedText>
          <ThemedText style={styles.descriptionText}>{tool.description}</ThemedText>
        </View>

        {/* Pickup Location */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Adresse</ThemedText>
          <View style={styles.row}>
            <View style={styles.locationContainer}>
              <ThemedText style={styles.locationText}>{tool.pickupLocation || 'Kein Abholort angegeben'}</ThemedText>
              {tool.pickupLocationNote ? (
                <ThemedText type="muted" style={styles.locationNote}>{tool.pickupLocationNote}</ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        {/* Owner Card */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Anbieter</ThemedText>
          <View style={styles.ownerCard}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{getInitials(providerName)}</ThemedText>
            </View>
            <View style={styles.ownerInfo}>
              <ThemedText type="defaultSemiBold">{providerName}</ThemedText>
              <ThemedText type="muted" style={styles.ownerSub}>Werkzeuganbieter</ThemedText>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <View style={styles.calendarHeaderRow}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Verfügbare Tage</ThemedText>
            <View style={styles.calendarNav}>
               <TouchableOpacity 
                  disabled={calendarMonthOffset === 0} 
                  onPress={() => setCalendarMonthOffset(o => Math.max(0, o - 1))}
                  style={[styles.navBtn, calendarMonthOffset === 0 && { opacity: 0.5 }]}
               >
                 <Ionicons name="chevron-back" size={20} color={Colors.text} />
               </TouchableOpacity>
               <TouchableOpacity 
                  onPress={() => setCalendarMonthOffset(o => o + 1)}
                  style={styles.navBtn}
               >
                 <Ionicons name="chevron-forward" size={20} color={Colors.text} />
               </TouchableOpacity>
            </View>
          </View>
          <ThemedText type="muted" style={{ marginBottom: Spacing.md }}>
            {canChooseDates
              ? isSelectingRangeEnd
                ? "Wähle jetzt den letzten Tag des Zeitraums."
                : "Wähle den ersten Tag des gewünschten Zeitraums."
              : "Dieses Werkzeug ist aktuell nicht verfügbar."}
          </ThemedText>

          {calendarMonths.map((month) => (
            <View key={month.key} style={styles.monthContainer}>
              <ThemedText type="defaultSemiBold" style={styles.monthLabel}>{month.label}</ThemedText>
              <View style={styles.weekDaysRow}>
                {WEEKDAYS.map(wd => <ThemedText key={wd} style={styles.weekDayText}>{wd}</ThemedText>)}
              </View>
              <View style={styles.daysGrid}>
                {month.days.map((day) => {
                  const dateKey = day.dateKey ?? "";
                  const isRangeStart = dateKey === startDate;
                  const isRangeEnd = dateKey === endDate;
                  const isInRange = Boolean(dateKey && dateKey >= startDate && dateKey <= endDate);
                  
                  if (day.day === null) {
                    return <View key={day.key} style={styles.dayCell} />;
                  }

                  const dayStyle: StyleProp<ViewStyle> = [styles.dayCellBtn];
                  const textStyle: StyleProp<TextStyle> = [styles.dayText];

                  if (!day.available) {
                    dayStyle.push(styles.dayUnavailable);
                    textStyle.push(styles.dayTextUnavailable);
                  } else {
                    dayStyle.push(styles.dayAvailable);
                    if (isInRange) {
                      dayStyle.push(styles.dayInRange);
                      textStyle.push(styles.dayTextInRange);
                    }
                    if (isRangeStart || isRangeEnd) {
                      dayStyle.push(styles.dayRangeExtreme);
                      textStyle.push(styles.dayTextExtreme);
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={dayStyle}
                      disabled={!day.available}
                      onPress={() => selectCalendarDate(dateKey)}
                    >
                      <ThemedText style={textStyle}>{day.day}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={styles.legendRow}>
             <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dayAvailable]} />
                <ThemedText type="muted" style={{fontSize: 12}}>Verfügbar</ThemedText>
             </View>
             <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dayUnavailable]} />
                <ThemedText type="muted" style={{fontSize: 12}}>Nicht verfügbar</ThemedText>
             </View>
          </View>
        </View>

        {/* Booking Form */}
        <View style={styles.bookingCard}>
          <ThemedText type="defaultSemiBold" style={styles.bookingTitle}>
            {isOwnTool ? 'Werkzeug für Eigenbedarf blockieren' : 'Werkzeug buchen'}
          </ThemedText>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          {success ? <ThemedText style={styles.successText}>{success}</ThemedText> : null}

          {canChooseDates ? (
            <>
              {/* Start */}
              <View style={styles.formSection}>
                <ThemedText type="defaultSemiBold" style={styles.inputLabel}>
                  {isOwnTool ? 'Beginn des Eigenbedarfs' : 'Abholdaten'}
                </ThemedText>
                <View style={styles.inputRow}>
                  <DateField
                    label="Datum"
                    value={startDate}
                    onChange={setStartDate}
                  />
                  <TimeField
                    label="Uhrzeit"
                    value={startTime}
                    onChange={setStartTime}
                    baseDate={startDate}
                  />
                </View>
              </View>

              {/* End */}
              <View style={styles.formSection}>
                <ThemedText type="defaultSemiBold" style={styles.inputLabel}>
                  {isOwnTool ? 'Ende des Eigenbedarfs' : 'Abgabedaten'}
                </ThemedText>
                <View style={styles.inputRow}>
                  <DateField
                    label="Datum"
                    value={endDate}
                    onChange={setEndDate}
                    minimumDate={parseLocalDateKey(startDate) ?? undefined}
                  />
                  <TimeField
                    label="Uhrzeit"
                    value={endTime}
                    onChange={setEndTime}
                    baseDate={endDate}
                  />
                </View>
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => validateAndSubmit(isOwnTool ? 'BLOCK' : 'BOOK')}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitButtonText}>
                    {isOwnTool ? 'Zeitraum blockieren' : 'Anfrage senden'}
                  </ThemedText>
                )}
              </TouchableOpacity>
              
              <ThemedText type="muted" style={styles.hintText}>
                {isOwnTool
                  ? 'Die Blockierung gilt sofort und erzeugt keine Nachricht.'
                  : 'Der Anbieter muss deine Anfrage noch bestätigen.'}
              </ThemedText>
            </>
          ) : (
            <View style={styles.disabledPanel}>
              <ThemedText style={styles.disabledText}>Dieses Werkzeug ist derzeit ausgeliehen.</ThemedText>
              <ThemedText type="muted" style={{fontSize:12, marginTop:4}}>Nach der Rückgabe kann es wieder angefragt werden.</ThemedText>
            </View>
          )}
        </View>

        {/* Ratings */}
        <View style={styles.section}>
          <RatingsSection ratings={ratings} />
        </View>

        {/* Melden Actions */}
        {!isOwnTool && (
          <View style={[styles.section, { marginTop: Spacing.xl, borderTopWidth: 0 }]}>
            <TouchableOpacity onPress={() => setReportTarget('TOOL')}>
              <ThemedText style={{ color: Colors.danger, textAlign: 'center', marginBottom: Spacing.sm }}>
                Werkzeug melden
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ReportForm
        visible={reportTarget !== null}
        title="Werkzeug melden"
        reason={reportReason}
        details={reportDetails}
        isSubmitting={isReporting}
        onReasonChange={setReportReason}
        onDetailsChange={setReportDetails}
        onSubmit={submitReport}
        onCancel={() => setReportTarget(null)}
      />
    </ScrollView>

    <ImageLightbox
      uri={previewImage}
      visible={previewImage !== null}
      onClose={() => setPreviewImage(null)}
    />
    </>
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
  imageContainer: {
    height: 320,
    backgroundColor: colors.border,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: Spacing.sm,
  },
  editButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: colors.brand,
    borderRadius: 20,
    padding: Spacing.sm,
  },
  content: {
    padding: Spacing.md,
  },
  headerInfo: {
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.brandSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
  },
  categoryText: {
    color: colors.brand,
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    color: colors.text,
  },
  section: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: Spacing.xs,
  },
  descriptionText: {
    lineHeight: 22,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 15,
    color: colors.text,
  },
  locationNote: {
    fontSize: 13,
    marginTop: 2,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  ownerInfo: {
    flex: 1,
  },
  ownerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  calendarNav: {
    flexDirection: 'row',
  },
  navBtn: {
    padding: Spacing.sm,
    marginLeft: Spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.sm,
  },
  monthContainer: {
    marginBottom: 0,
  },
  monthLabel: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    padding: 2,
  },
  dayCellBtn: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginVertical: 1,
  },
  dayAvailable: {
    backgroundColor: colors.success + '20',
  },
  dayUnavailable: {
    backgroundColor: colors.surfaceSoft,
  },
  dayInRange: {
    backgroundColor: colors.success,
  },
  dayRangeExtreme: {
    backgroundColor: colors.brand,
  },
  dayText: {
    fontSize: 14,
  },
  dayTextUnavailable: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  dayTextInRange: {
    color: '#FFF',
  },
  dayTextExtreme: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  legendRow: {
    flexDirection: 'row',
    marginTop: 0,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: Spacing.lg,
  },
  bookingTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  formSection: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    flex: 0.48,
  },
  miniLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.sm,
    height: 40,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  submitButton: {
    backgroundColor: colors.brand,
    height: 46,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitButtonText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledPanel: {
    backgroundColor: colors.bg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  disabledText: {
    color: colors.text,
    fontWeight: 'bold',
  },
  hintText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: 'bold',
  },
  successText: {
    color: colors.success,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: 'bold',
  }
}));
