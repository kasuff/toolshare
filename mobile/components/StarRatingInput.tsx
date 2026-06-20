import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../constants/theme';
import { ThemedText } from './ThemedText';

type Props = {
  value: number;
  onChange: (score: number) => void;
  disabled?: boolean;
};

export function StarRatingInput({ value, onChange, disabled = false }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <TouchableOpacity
              key={score}
              disabled={disabled}
              onPress={() => onChange(score)}
              style={styles.starButton}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={active ? "star" : "star-outline"} 
                size={32} 
                color={active ? Colors.highlight : Colors.textMuted} 
              />
            </TouchableOpacity>
          );
        })}
      </View>
      {value > 0 && <ThemedText type="muted" style={styles.hint}>{value} von 5 Sternen</ThemedText>}
    </View>
  );
}

export function StarRatingDisplay({ score, size = 16 }: { score: number; size?: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <View style={styles.displayRow}>
      {Array.from({ length: 5 }, (_, index) => {
        const active = index < rounded;
        return (
          <Ionicons
            key={index}
            name={active ? "star" : "star-outline"}
            size={size}
            color={active ? Colors.highlight : Colors.textMuted}
            style={{ marginRight: 2 }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
  },
  hint: {
    marginTop: Spacing.sm,
    fontSize: 14,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});
