import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Workshop, WorkshopSlot, Tool, api, DEFAULT_PLACEHOLDER_IMAGE } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { LoadingSpinner } from '../../../components/EmptyState';
import { ImageLightbox } from '../../../components/ImageLightbox';
import { Ionicons } from '@expo/vector-icons';
import { DateField, TimeField } from '../../../components/DateTimeFields';
import { getDefaultDateRange, parseLocalDateKey, toLocalDateKey } from '../../../utils/dateTime';
import { RatingsSection } from '../../../components/RatingsSection';
import type { PublicRating } from '@toolshare/shared';
import { ReportForm } from '../../../components/ReportForm';

type CalendarDay = {
  key: string;
  day: number | null;
  dateKey?: string;
  available?: boolean;
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const GALLERY_HEIGHT = 240;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WORKSHOP_EXTRAS = [
  { value: "handwerkzeug", label: "Handwerkzeug", icon: "hammer-outline" },
  { value: "3d-drucker", label: "3D-Drucker", icon: "print-outline" },
  { value: "starkstrom", label: "Starkstrom", icon: "flash-outline" },
  { value: "wlan", label: "WLAN", icon: "wifi-outline" },
  { value: "ups-tee", label: "Kaffee & Tee", icon: "cafe-outline" },
  { value: "anlieferung", label: "Anlieferung", icon: "car-outline" },
  { value: "werkstube", label: "Werkstube", icon: "construct-outline" },
  { value: "parkplatz", label: "Parkplatz", icon: "car-sport-outline" }
] as const;

function rangeOverlapsDay(startIso: string, endIso: string, day: Date) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return new Date(startIso) < dayEnd && new Date(endIso) > dayStart;
}

import type { WorkshopBookedRange } from '@toolshare/shared';

function isDayUnavailable(day: Date, slots: WorkshopSlot[], bookedRanges: WorkshopBookedRange[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (day < todayStart) {
    return true;
  }
  const blocked = slots.some((slot) => slot.blockedByOwner && rangeOverlapsDay(slot.startIso, slot.endIso, day));
  const booked = bookedRanges.some((range) => rangeOverlapsDay(range.startIso, range.endIso, day));
  return blocked || booked;
}

function getWorkshopCalendarDays(monthDate: Date, slots: WorkshopSlot[], bookedRanges: WorkshopBookedRange[]): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    days.push({ key: `empty-${index}`, day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toLocalDateKey(date);
    days.push({
      key: dateKey,
      day,
      dateKey,
      available: !isDayUnavailable(date, slots, bookedRanges)
    });
  }

  return days;
}

function isDateRangeAvailable(startDate: string, endDate: string, slots: WorkshopSlot[], bookedRanges: WorkshopBookedRange[]) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return false;

  const current = new Date(start);
  while (current <= end) {
    if (isDayUnavailable(current, slots, bookedRanges)) return false;
    current.setDate(current.getDate() + 1);
  }
  return true;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function WorkshopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [slots, setSlots] = useState<WorkshopSlot[]>([]);
  const [bookedRanges, setBookedRanges] = useState<WorkshopBookedRange[]>([]);
  const [ratings, setRatings] = useState<PublicRating[]>([]);
  const [tools, setTools] = useState<(Tool & { selectable: boolean })[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Report states
  const [reportTarget, setReportTarget] = useState<'WORKSHOP' | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  
  const defaults = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [endTime, setEndTime] = useState('14:00');
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [isSelectingRangeEnd, setIsSelectingRangeEnd] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { token, currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setActiveImageIndex(0);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!token || !id) return;
        try {
          const [found, workshopRatings] = await Promise.all([
            api.getWorkshopById(id, token),
            api.getRatingsForWorkshop(id).catch(() => [])
          ]);
          
          if (found) {
            setWorkshop(found.workshop);
            setSlots(found.slots);
            setBookedRanges(found.bookedRanges);
            setRatings(workshopRatings);
            
            const mappedTools = found.workshop.equipmentItems.map(item => ({
              id: item.id,
              ownerId: found.workshop.ownerId,
              ownerName: found.workshop.ownerName,
              name: item.name,
              description: "Werkstatt-Werkzeug",
              category: item.category,
              imageUrl: "",
              status: "VERFUEGBAR" as const,
              selectable: true
            }));
            
            setTools(mappedTools);
            setSelectedToolIds(mappedTools.filter(t => t.selectable).map(t => t.id));
          }
        } catch (e) {
          console.error(e);
          setError('Fehler beim Laden der Werkstattdaten.');
        } finally {
          setIsLoading(false);
        }
      }
      load();
    }, [id, token])
  );

  const isOwnWorkshop = Boolean(workshop && currentUser?.id === workshop.ownerId);
  const workshopImages = useMemo(() => {
    const urls = workshop?.imageUrls?.filter(Boolean) ?? [];
    return urls.length > 0 ? urls.slice(0, 3) : [DEFAULT_PLACEHOLDER_IMAGE];
  }, [workshop?.imageUrls]);
  const providerName = workshop?.ownerName ?? "Unbekannt";

  const onGalleryScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(index);
  }, []);

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
        days: getWorkshopCalendarDays(monthDate, slots, bookedRanges)
      };
    });
  }, [slots, bookedRanges, calendarMonthOffset]);

  const selectCalendarDate = (dateKey: string) => {
    if (!isSelectingRangeEnd || dateKey < startDate) {
      setStartDate(dateKey);
      setEndDate(dateKey);
      setIsSelectingRangeEnd(true);
      return;
    }
    if (!isDateRangeAvailable(startDate, dateKey, slots, bookedRanges)) {
      setError("Der gewählte Zeitraum enthält nicht verfügbare Tage.");
      return;
    }
    setError('');
    setEndDate(dateKey);
    setIsSelectingRangeEnd(false);
  };

  const handleBookWorkshop = async () => {
    setError('');
    setSuccess('');

    if (!startDate || !endDate || !startTime || !endTime) {
      setError('Bitte Datum und Uhrzeit vollständig ausfüllen.');
      return;
    }

    const startIso = `${startDate}T${startTime}`;
    const endIso = `${endDate}T${endTime}`;

    if (new Date(startIso) < new Date()) {
      setError('Der Startzeitpunkt darf nicht in der Vergangenheit liegen.');
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setError('Das Enddatum muss nach dem Startdatum liegen.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isOwnWorkshop) {
        await api.createWorkshopTimeslot(workshop!.id, { startIso, endIso, blockedByOwner: true }, token!);
        setSuccess('Werkstatt für Eigenbedarf blockiert!');
        // Reload slots
        const refreshed = await api.getWorkshopById(workshop!.id, token!);
        setSlots(refreshed.slots);
      } else {
        await api.createWorkshopBooking({
          workshopId: workshop!.id,
          startIso,
          endIso,
          workshopToolIds: selectedToolIds
        }, token!);
        setSuccess('Buchungsanfrage erfolgreich!');
        setTimeout(() => {
          router.replace('/inbox');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Buchung fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;
    setIsReporting(true);
    try {
      await api.createReport(
        {
          targetId: workshop!.id,
          targetType: 'WORKSHOP',
          reason: reportReason,
          details: reportDetails,
        },
        token!
      );
      Alert.alert('Erfolg', 'Meldung wurde gesendet.');
      setReportTarget(null);
      setReportReason('');
      setReportDetails('');
    } catch (err: any) {
      Alert.alert('Fehler', err.message || 'Fehler beim Senden der Meldung');
    } finally {
      setIsReporting(false);
    }
  };

  const toggleToolSelection = (toolId: string) => {
    setSelectedToolIds(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  if (isLoading) return <LoadingSpinner />;
  if (!workshop) {
    return (
      <View style={styles.center}>
        <ThemedText>Werkstatt nicht gefunden.</ThemedText>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container}>
      {/* Image Gallery */}
      <View style={styles.imageContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onGalleryScroll}
          scrollEventThrottle={16}
          style={styles.galleryScroll}
        >
          {workshopImages.map((uri, index) => (
            <Pressable key={`${uri}-${index}`} onPress={() => setPreviewImage(uri)}>
              <Image
                source={{ uri }}
                style={styles.galleryImage}
              />
            </Pressable>
          ))}
        </ScrollView>

        {workshopImages.length > 1 ? (
          <>
            <View style={styles.galleryDots}>
              {workshopImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.galleryDot,
                    index === activeImageIndex && styles.galleryDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.galleryCounter}>
              <ThemedText style={styles.galleryCounterText}>
                {activeImageIndex + 1} / {workshopImages.length}
              </ThemedText>
            </View>
          </>
        ) : null}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        {isOwnWorkshop && (
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => router.push(`/workshops/edit?id=${workshop.id}`)}
          >
            <Ionicons name="pencil" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Title */}
        <ThemedText type="title">{workshop.name}</ThemedText>
        
        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={18} color={Colors.brand} style={styles.iconMargin} />
          <ThemedText style={styles.locationText}>{workshop.location}</ThemedText>
        </View>
        
        {/* Description */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Beschreibung</ThemedText>
          <ThemedText style={styles.descriptionText}>{workshop.description}</ThemedText>
        </View>

        {/* Details Card */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Details</ThemedText>
          <View style={styles.detailsCard}>
            <View style={styles.detailsItem}>
              <Ionicons name="people-outline" size={20} color={Colors.brand} style={styles.iconMargin} />
              <ThemedText style={styles.detailsText}>
                Maximale Kapazität: {workshop.maxCapacity} Personen
              </ThemedText>
            </View>

            {workshop.extras && workshop.extras.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md }} />
                <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.sm }}>Zusatzmerkmale:</ThemedText>
                <View style={styles.extrasGrid}>
                  {workshop.extras.map(extraVal => {
                    const extraDef = WORKSHOP_EXTRAS.find(e => e.value === extraVal);
                    if (!extraDef) return null;
                    return (
                      <View key={extraVal} style={styles.extraChip}>
                        <Ionicons name={extraDef.icon as any} size={16} color={Colors.text} style={{ marginRight: 6 }} />
                        <ThemedText style={styles.extraChipText}>{extraDef.label}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
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
              <ThemedText type="muted" style={styles.ownerSub}>Werkstattanbieter</ThemedText>
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
            {isSelectingRangeEnd
              ? "Wähle jetzt den letzten Tag des Zeitraums."
              : "Wähle den ersten Tag des gewünschten Zeitraums."}
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

                  const dayStyle: any = [styles.dayCellBtn];
                  const textStyle: any = [styles.dayText];

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
        </View>
        
        {/* Tools Selection (if not own workshop) */}
        {!isOwnWorkshop && tools.length > 0 && (
          <View style={styles.section}>
             <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Benötigtes Werkzeug</ThemedText>
             {tools.map(tool => (
               <TouchableOpacity 
                  key={tool.id} 
                  style={[styles.toolSelectionRow, selectedToolIds.includes(tool.id) && styles.toolSelectionRowSelected]}
                  onPress={() => toggleToolSelection(tool.id)}
               >
                 <Ionicons 
                    name={selectedToolIds.includes(tool.id) ? "checkbox" : "square-outline"} 
                    size={22} 
                    color={Colors.brand} 
                    style={styles.iconMargin} 
                 />
                 <ThemedText style={styles.toolSelectionText}>{tool.name} ({tool.category})</ThemedText>
               </TouchableOpacity>
             ))}
          </View>
        )}

        {/* Booking Card */}
        <View style={styles.bookingCard}>
          <ThemedText type="defaultSemiBold" style={styles.bookingTitle}>
            {isOwnWorkshop ? 'Zeitfenster für Eigenbedarf blockieren' : 'Werkstatt buchen'}
          </ThemedText>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          {success ? <ThemedText style={styles.successText}>{success}</ThemedText> : null}

          {/* Start Date & Time */}
          <View style={styles.formSection}>
            <ThemedText type="defaultSemiBold" style={styles.inputLabel}>
               {isOwnWorkshop ? 'Beginn' : 'Startzeitraum'}
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

          {/* End Date & Time */}
          <View style={styles.formSection}>
            <ThemedText type="defaultSemiBold" style={styles.inputLabel}>
               {isOwnWorkshop ? 'Ende' : 'Endzeitraum'}
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

          <TouchableOpacity style={styles.submitButton} onPress={handleBookWorkshop} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <ThemedText style={styles.submitButtonText}>
                 {isOwnWorkshop ? 'Zeitfenster blockieren' : 'Buchung anfragen'}
              </ThemedText>
            )}
          </TouchableOpacity>

          <ThemedText type="muted" style={styles.hintText}>
             {isOwnWorkshop 
               ? 'Die Blockierung gilt sofort und erzeugt keine Nachricht.'
               : 'Der Werkstattbesitzer muss deine Buchung manuell prüfen und annehmen.'}
          </ThemedText>
        </View>

        {/* Ratings */}
        <View style={styles.section}>
          <RatingsSection ratings={ratings} />
          {/* Melden Actions */}
          {!isOwnWorkshop && (
            <View style={[styles.section, { marginTop: Spacing.xl, borderTopWidth: 0 }]}>
              <TouchableOpacity onPress={() => setReportTarget('WORKSHOP')}>
                <ThemedText style={{ color: Colors.danger, textAlign: 'center', marginBottom: Spacing.sm }}>
                  Werkstatt melden
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>

    <ReportForm
      visible={reportTarget !== null}
      title="Werkstatt melden"
      reason={reportReason}
      details={reportDetails}
      isSubmitting={isReporting}
      onReasonChange={setReportReason}
      onDetailsChange={setReportDetails}
      onSubmit={submitReport}
      onCancel={() => setReportTarget(null)}
    />

    <ImageLightbox
      uri={previewImage}
      visible={previewImage !== null}
      onClose={() => setPreviewImage(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  imageContainer: {
    height: GALLERY_HEIGHT,
    backgroundColor: Colors.border,
    position: 'relative',
  },
  galleryScroll: {
    height: GALLERY_HEIGHT,
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
    resizeMode: 'cover',
  },
  galleryDots: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  galleryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  galleryDotActive: {
    backgroundColor: '#FFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  galleryCounter: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  galleryCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: Colors.border,
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
    backgroundColor: Colors.brand,
    borderRadius: 20,
    padding: Spacing.sm,
  },
  content: {
    padding: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  locationText: {
    fontSize: 16,
    color: Colors.text,
  },
  iconMargin: {
    marginRight: Spacing.sm,
  },
  section: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: Spacing.xs,
  },
  descriptionText: {
    lineHeight: 22,
    color: Colors.text,
  },
  detailsCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsText: {
    fontSize: 14,
    color: Colors.text,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: Colors.surface,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textMuted,
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
    backgroundColor: '#DEF7EC',
  },
  dayUnavailable: {
    backgroundColor: '#F3F4F6',
  },
  dayInRange: {
    backgroundColor: '#31C48D',
  },
  dayRangeExtreme: {
    backgroundColor: Colors.brand,
  },
  dayText: {
    fontSize: 14,
  },
  dayTextUnavailable: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  dayTextInRange: {
    color: '#FFF',
  },
  dayTextExtreme: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  toolSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toolSelectionRowSelected: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  toolSelectionText: {
    fontSize: 15,
  },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textMuted,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    height: 40,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.bg,
  },
  submitButton: {
    backgroundColor: Colors.brand,
    height: 46,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.danger,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  successText: {
    color: Colors.success,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  extrasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  extraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  extraChipText: {
    fontSize: 13,
  },
});
