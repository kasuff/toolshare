import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Modal, Animated } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, useThemeColors, createThemedStyleSheet } from '../../constants/theme';
import { ThemedText } from '../../components/ThemedText';
import { EmptyState } from '../../components/EmptyState';
import { ToolCard } from '../../components/ToolCard';
import { WorkshopCard } from '../../components/WorkshopCard';
import { useAuth } from '../../hooks/useAuth';
import { useMyOffers } from '../../hooks/queries/offers.queries';
import { getErrorMessage } from '../../utils/errors';

export default function OffersScreen() {
  const { currentUser, token } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const colors = useThemeColors();
  const styles = useStyles();

  const { data, isLoading, isRefetching, isError, error: queryError, refetch } = useMyOffers(
    currentUser?.id,
    token
  );
  const tools = data?.tools ?? [];
  const workshops = data?.workshops ?? [];
  const loading = isLoading && Boolean(currentUser && token);
  const error = isError ? getErrorMessage(queryError, 'Angebote konnten nicht geladen werden.') : null;

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openDropdown = useCallback(() => {
    setIsDropdownOpen(true);
    dropdownAnimation.setValue(0);
    Animated.timing(dropdownAnimation, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [dropdownAnimation]);

  const closeDropdown = useCallback((onClosed?: () => void) => {
    Animated.timing(dropdownAnimation, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsDropdownOpen(false);
        onClosed?.();
      }
    });
  }, [dropdownAnimation]);

  if (!currentUser) {
    return (
      <View style={styles.center}>
        <EmptyState title="Nicht angemeldet" text="Bitte melde dich an, um deine Angebote zu sehen." />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const hasOffers = tools.length > 0 || workshops.length > 0;

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <ThemedText type="title">Meine Angebote</ThemedText>
          <ThemedText type="muted" style={styles.subtitle}>Verwalte deine eingestellten Werkzeuge und Werkstätten.</ThemedText>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openDropdown}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Modal visible={isDropdownOpen} transparent animationType="none">
        <View style={styles.dropdownOverlay}>
          <Animated.View style={[styles.dropdownBackdrop, { opacity: dropdownAnimation }]} />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closeDropdown()} />
          <Animated.View
            style={[
              styles.dropdownMenu,
              {
                opacity: dropdownAnimation,
                transform: [
                  {
                    translateY: dropdownAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                  {
                    scale: dropdownAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                closeDropdown(() => {
                  router.push({ pathname: '/tools/new', params: { returnTo: '/offers' } });
                });
              }}
            >
              <Ionicons name="hammer-outline" size={20} color={colors.text} style={styles.dropdownIcon} />
              <ThemedText>Werkzeug hinzufügen</ThemedText>
            </TouchableOpacity>
            <View style={styles.dropdownDivider} />
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                closeDropdown(() => {
                  router.push({ pathname: '/workshops/new', params: { returnTo: '/offers' } });
                });
              }}
            >
              <Ionicons name="home-outline" size={20} color={colors.text} style={styles.dropdownIcon} />
              <ThemedText>Werkstatt hinzufügen</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      
      {error && (
        <ThemedText style={styles.error}>{error}</ThemedText>
      )}

      {!hasOffers && !error && (
        <EmptyState 
          title="Noch keine Angebote" 
          text="Du hast noch keine Werkzeuge oder Werkstätten angeboten." 
        />
      )}

      {workshops.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Werkstätten</ThemedText>
          {workshops.map(workshop => (
            <WorkshopCard
              key={workshop.id}
              workshop={workshop}
              onPress={() => router.push(`/workshops/${workshop.id}`)}
            />
          ))}
        </View>
      )}

      {tools.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Werkzeuge</ThemedText>
          {tools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onPress={() => router.push(`/tools/${tool.id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.brand,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: colors.brandStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  dropdownOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: Spacing.md,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  dropdownIcon: {
    marginRight: Spacing.sm,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: Spacing.sm,
  }
}));
