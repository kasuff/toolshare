import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useThemeColors, createThemedStyleSheet } from '../constants/theme';
import { ThemedText } from './ThemedText';

export function EmptyState({ title, text }: { title: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
      <ThemedText type="muted" style={styles.text}>{text}</ThemedText>
    </View>
  );
}

export function LoadingSpinner() {
  const colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 16,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  text: {
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  }
}));
