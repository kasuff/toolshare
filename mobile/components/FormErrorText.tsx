import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, useThemeColors, createThemedStyleSheet } from '../constants/theme';
import { ThemedText } from './ThemedText';

type Props = {
  error?: string | null;
  style?: object;
};

export function FormErrorText({ error, style }: Props) {
  const colors = useThemeColors();
  const styles = useStyles();

  if (!error) return null;

  return (
    <View style={[styles.container, style]}>
      <Ionicons name="alert-circle" size={16} color={colors.danger} style={styles.icon} />
      <ThemedText style={styles.text}>{error}</ThemedText>
    </View>
  );
}

type SummaryProps = {
  errors?: Record<string, string>;
  error?: string | null;
  style?: object;
};

export function FormErrorsSummary({ errors = {}, error, style }: SummaryProps) {
  const messages = [
    ...Object.values(errors).filter(Boolean),
    ...(error ? [error] : []),
  ];

  if (messages.length === 0) return null;

  return (
    <View style={style}>
      {messages.map((message, index) => (
        <FormErrorText key={`${message}-${index}`} error={message} />
      ))}
    </View>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
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
    color: colors.danger,
    fontSize: 13,
    flex: 1,
  },
}));
