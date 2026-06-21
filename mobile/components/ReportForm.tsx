import React from 'react';
import { View, StyleSheet, TextInput, Pressable, Modal, ActivityIndicator } from 'react-native';
import { ThemedText } from './ThemedText';
import { Spacing, Radius, useThemeColors, createThemedStyleSheet } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ReportFormProps {
  visible: boolean;
  title: string;
  hint?: string;
  reason: string;
  details: string;
  isSubmitting: boolean;
  submitLabel?: string;
  onReasonChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ReportForm({
  visible,
  title,
  hint,
  reason,
  details,
  isSubmitting,
  submitLabel = "Meldung absenden",
  onReasonChange,
  onDetailsChange,
  onSubmit,
  onCancel
}: ReportFormProps) {
  const colors = useThemeColors();
  const styles = useStyles();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <Pressable onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          
          {hint && <ThemedText style={styles.hint}>{hint}</ThemedText>}
          
          <View style={styles.field}>
            <ThemedText style={styles.label}>Grund</ThemedText>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={onReasonChange}
              placeholder="z. B. unpassende Inhalte oder Verhalten"
              placeholderTextColor={colors.textMuted}
              editable={!isSubmitting}
            />
          </View>
          
          <View style={styles.field}>
            <ThemedText style={styles.label}>Details (optional)</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={details}
              onChangeText={onDetailsChange}
              placeholder="Weitere Hinweise für die Moderation"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              editable={!isSubmitting}
            />
          </View>
          
          <View style={styles.actions}>
            <Pressable 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
              disabled={isSubmitting}
            >
              <ThemedText style={styles.cancelButtonText}>Abbrechen</ThemedText>
            </Pressable>
            
            <Pressable 
              style={[styles.button, styles.submitButton, isSubmitting && styles.buttonDisabled]} 
              onPress={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <ThemedText style={styles.submitButtonText}>{submitLabel}</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  hint: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: Spacing.md,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.bg,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.brand,
    minWidth: 120,
  },
  submitButtonText: {
    color: colors.surface,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
}));
