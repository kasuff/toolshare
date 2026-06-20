import { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TextInput, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Tool, api, TOOL_CATEGORIES, pluralize } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { ToolCard } from '../../../components/ToolCard';
import { EmptyState, LoadingSpinner } from '../../../components/EmptyState';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { DateField } from '../../../components/DateTimeFields';

export default function ToolsScreen() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [borrowFrom, setBorrowFrom] = useState('');
  const [borrowUntil, setBorrowUntil] = useState('');
  
  const { token } = useAuth();
  const router = useRouter();

  const loadTools = async (query = search, cat = selectedCategory) => {
    if (!token) return;
    try {
      const data = await api.getTools({
        q: query || undefined,
        category: cat || undefined
      }, token);
      setTools(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTools(search, selectedCategory);
  }, [token, selectedCategory]);

  const handleSearchSubmit = () => {
    setIsLoading(true);
    loadTools(search, selectedCategory);
  };

  const handleClearSearch = () => {
    setSearch('');
    setIsLoading(true);
    loadTools('', selectedCategory);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadTools(search, selectedCategory);
  };

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      if (borrowFrom || borrowUntil) {
        if (tool.status !== 'VERFUEGBAR') return false;
      }
      return true;
    });
  }, [tools, borrowFrom, borrowUntil]);

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Nach Werkzeugen suchen..."
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
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <Pressable
            style={[styles.categoryBadge, !selectedCategory && styles.categoryBadgeActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <ThemedText style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              Alle
            </ThemedText>
          </Pressable>
          {TOOL_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <Pressable
                key={cat.value}
                style={[styles.categoryBadge, isActive && styles.categoryBadgeActive]}
                onPress={() => setSelectedCategory(cat.value)}
              >
                <ThemedText style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <View style={styles.resultsHeader}>
            <ThemedText style={styles.resultsText}>
              {pluralize(filteredTools.length, "Ergebnis", "Ergebnisse")}
            </ThemedText>
          </View>
          <FlatList
          data={filteredTools}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.brand]} />}
          ListEmptyComponent={() => (
            <EmptyState 
              title="Keine Werkzeuge gefunden" 
              text="Es gibt aktuell keine Werkzeuge, die deinen Suchkriterien entsprechen." 
            />
          )}
          renderItem={({ item }) => (
            <ToolCard 
              tool={item} 
              onPress={() => router.push(`/tools/${item.id}`)} 
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
  categoryScroll: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBadgeActive: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  categoryText: {
    fontSize: 13,
    color: Colors.text,
  },
  categoryTextActive: {
    color: Colors.surface,
    fontWeight: 'bold',
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
