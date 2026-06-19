import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/theme';
import { ThemedText } from './ThemedText';

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
      <ThemedText type="muted" style={styles.text}>{text}</ThemedText>
    </View>
  );
}

export function LoadingSpinner() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
});
