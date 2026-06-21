import { ComponentProps, useEffect, useState, useMemo, useCallback } from 'react';
import { View, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
const SliderComponent = Slider as unknown as React.ComponentType<ComponentProps<typeof Slider>>;
import { useRouter } from 'expo-router';
import { Workshop, WorkshopBookedRange, WorkshopSlot, api, pluralize, isDateRangeAvailable } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { WorkshopCard } from '../../../components/WorkshopCard';
import { EmptyState, LoadingSpinner } from '../../../components/EmptyState';
import { useThemeColors, createThemedStyleSheet, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { DateField } from '../../../components/DateTimeFields';
import { getErrorMessage } from '../../../utils/errors';

interface WorkshopOffer {
  workshop: Workshop;
  slots: WorkshopSlot[];
  bookedRanges?: WorkshopBookedRange[];
}

export default function WorkshopsScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const [workshops, setWorkshops] = useState<WorkshopOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 450);
  
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [borrowFrom, setBorrowFrom] = useState('');
  const [borrowUntil, setBorrowUntil] = useState('');
  const [capacityStr, setCapacityStr] = useState('10');

  const { token } = useAuth();
  const router = useRouter();

  const loadWorkshops = useCallback(async (query: string) => {
    if (!token) return;
    try {
      setError(null);
      const data = await api.getWorkshops({ q: query || undefined }, token);
      setWorkshops(data);
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, 'Werkstätten konnten nicht geladen werden.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    loadWorkshops(debouncedSearch);
  }, [loadWorkshops, debouncedSearch]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    loadWorkshops(search);
  };

  const handleClearSearch = () => {
    setSearch('');
    setIsLoading(true);
    loadWorkshops('');
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadWorkshops(debouncedSearch);
  };

  const maxCapacity = parseInt(capacityStr, 10) || 10;

  const filteredWorkshops = useMemo(() => {
    return workshops.filter((item) => {
      if (item.workshop.maxCapacity > maxCapacity) {
        return false;
      }
      if (borrowFrom && borrowUntil) {
        if (!isDateRangeAvailable(borrowFrom, borrowUntil, item.slots || [], item.bookedRanges || [])) {
          return false;
        }
      }
      return true;
    });
  }, [workshops, borrowFrom, borrowUntil, maxCapacity]);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Nach Werkstätten suchen..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={handleClearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable 
            style={[styles.filterToggleButton, isFiltersExpanded && styles.filterToggleButtonActive]} 
            onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
          >
            <Ionicons name="options-outline" size={24} color={isFiltersExpanded ? Colors.surface : Colors.text} />
          </Pressable>
        </View>

        {isFiltersExpanded && (
          <View style={styles.advancedFilters}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <DateField label="Ausleihe von" value={borrowFrom} onChange={setBorrowFrom} />
              <DateField label="Ausleihe bis" value={borrowUntil} onChange={setBorrowUntil} />
            </View>

            <View style={styles.numericField}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={styles.filterLabel}>Maximale Kapazität (Personen)</ThemedText>
                <ThemedText style={[styles.filterLabel, { color: Colors.brand, fontWeight: 'bold' }]}>
                  {capacityStr}
                </ThemedText>
              </View>
              <SliderComponent
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={parseInt(capacityStr, 10) || 10}
                onValueChange={(val: number) => setCapacityStr(val.toString())}
                minimumTrackTintColor={Colors.brand}
                maximumTrackTintColor={Colors.border}
                thumbTintColor={Colors.brand}
              />
            </View>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable onPress={() => {
            setIsLoading(true);
            loadWorkshops(debouncedSearch);
          }}>
            <ThemedText style={styles.retryText}>Erneut versuchen</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <View style={styles.resultsHeader}>
            <ThemedText style={styles.resultsText}>
              {pluralize(filteredWorkshops.length, "Ergebnis", "Ergebnisse")}
            </ThemedText>
          </View>
          <FlatList
          data={filteredWorkshops}
          keyExtractor={(item) => item.workshop.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.brand]} />}
          ListEmptyComponent={() => (
            <EmptyState 
              title="Keine Werkstätten gefunden" 
              text="Aktuell sind keine Werkstätten verfügbar, die deinen Kriterien entsprechen." 
            />
          )}
          renderItem={({ item }) => (
            <WorkshopCard 
              workshop={item.workshop} 
              onPress={() => router.push(`/workshops/${item.workshop.id}`)} 
            />
          )}
        />
        </>
      )}
    </View>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  filterContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
  },
  filterToggleButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleButtonActive: {
    backgroundColor: colors.brand,
  },
  advancedFilters: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: colors.bg,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  filterLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: Spacing.xs,
  },
  numericField: {
    flexDirection: 'column',
  },
  numericInput: {
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 44,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultsHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  resultsText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  list: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: Spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  retryText: {
    color: colors.brand,
    fontWeight: '600',
    fontSize: 14,
  },
}));
