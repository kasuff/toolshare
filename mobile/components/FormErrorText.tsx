import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import { ThemedText } from './ThemedText';

type Props = {
  error?: string | null;
  style?: object;
};

export function FormErrorText({ error, style }: Props) {
  if (!error) return null;

  return (
    <View style={[styles.container, style]}>
      <Ionicons name="alert-circle" size={16} color={Colors.danger} style={styles.icon} />
      <ThemedText style={styles.text}>{error}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    color: Colors.danger,
    fontSize: 13,
    flex: 1,
  },
});
