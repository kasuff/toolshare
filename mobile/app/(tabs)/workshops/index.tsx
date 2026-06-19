import { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Workshop, api, pluralize, isDateRangeAvailable } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { WorkshopCard } from '../../../components/WorkshopCard';
import { EmptyState, LoadingSpinner } from '../../../components/EmptyState';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { DateField } from '../../../components/DateTimeFields';

interface WorkshopOffer {
  workshop: Workshop;
  slots: any[];
  bookedRanges?: any[];
}

export default function WorkshopsScreen() {
  const [workshops, setWorkshops] = useState<WorkshopOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [borrowFrom, setBorrowFrom] = useState('');
  const [borrowUntil, setBorrowUntil] = useState('');
  const [capacityStr, setCapacityStr] = useState('10');

  const { token } = useAuth();
  const router = useRouter();

  const loadWorkshops = async (query = search) => {
    if (!token) return;
    try {
      const data = await api.getWorkshops({ q: query || undefined }, token);
      setWorkshops(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkshops(search);
  }, [token]);

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
    loadWorkshops(search);
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
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={parseInt(capacityStr, 10) || 10}
                onValueChange={(val) => setCapacityStr(val.toString())}
                minimumTrackTintColor={Colors.brand}
                maximumTrackTintColor={Colors.border}
                thumbTintColor={Colors.brand}
              />
            </View>
          </View>
        )}
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  filterContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    backgroundColor: Colors.bg,
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
    color: Colors.text,
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
  },
  filterToggleButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleButtonActive: {
    backgroundColor: Colors.brand,
  },
  advancedFilters: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  filterLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  numericField: {
    flexDirection: 'column',
  },
  numericInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 44,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultsHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  resultsText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  list: {
    padding: Spacing.md,
    paddingTop: 0,
  },
});
