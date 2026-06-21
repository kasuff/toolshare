import React from 'react';
import { View, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, useThemeColors, createThemedStyleSheet } from '../constants/theme';
import { ThemedText } from './ThemedText';
import { StarRatingInput } from './StarRatingInput';

type Props = {
  title: string;
  hint?: string;
  targetLabel: string;
  score: number;
  comment: string;
  isSubmitting: boolean;
  onScoreChange: (score: number) => void;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  visible: boolean;
};

export function RatingFormPanel({
  title,
  hint,
  targetLabel,
  score,
  comment,
  isSubmitting,
  onScoreChange,
  onCommentChange,
  onSubmit,
  onCancel,
  visible
}: Props) {
  const colors = useThemeColors();
  const styles = useStyles();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView 
        style={styles.backdrop} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.panel}>
          <View style={styles.header}>
            <ThemedText type="title" style={{ flex: 1 }}>{title}</ThemedText>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {hint && <ThemedText type="muted" style={styles.hint}>{hint}</ThemedText>}
            
            <ThemedText style={styles.targetLabel}>
              Bewertung für <ThemedText style={{ fontWeight: 'bold' }}>{targetLabel}</ThemedText>
            </ThemedText>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Sterne</ThemedText>
              <StarRatingInput value={score} onChange={onScoreChange} disabled={isSubmitting} />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.label}>Kommentar (optional)</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={comment}
                onChangeText={onCommentChange}
                placeholder="Wie war die Ausleihe?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]} 
                onPress={onCancel} 
                disabled={isSubmitting}
              >
                <ThemedText style={styles.buttonSecondaryText}>Später</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, (isSubmitting || score < 1) && styles.buttonDisabled]} 
                onPress={onSubmit} 
                disabled={isSubmitting || score < 1}
              >
                <ThemedText style={styles.buttonText}>
                  {isSubmitting ? "Speichern..." : "Speichern"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  hint: {
    marginBottom: Spacing.sm,
  },
  targetLabel: {
    marginBottom: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  }
}));
