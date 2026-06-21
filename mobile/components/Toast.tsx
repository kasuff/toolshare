import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useToast } from '../hooks/useToast';
import { Spacing, Radius, useThemeColors, createThemedStyleSheet } from '../constants/theme';
import { ThemedText } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';

export function ToastViewport() {
  const { toasts, removeToast } = useToast();
  const colors = useThemeColors();
  const styles = useStyles();

  if (toasts.length === 0) return null;

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      <View style={styles.toastList} pointerEvents="box-none">
        {toasts.map((toast) => {
          const isError = toast.tone === 'error';
          const isSuccess = toast.tone === 'success';

          return (
            <View 
              key={toast.id} 
              style={[
                styles.toast,
                isError && styles.toastError,
                isSuccess && styles.toastSuccess
              ]}
            >
              <ThemedText style={[
                styles.toastText,
                isError && styles.toastTextError,
                isSuccess && styles.toastTextSuccess
              ]}>
                {toast.text}
              </ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => removeToast(toast.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons 
                  name="close" 
                  size={20} 
                  color={isError ? colors.surface : (isSuccess ? colors.surface : colors.text)} 
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  toastList: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    maxWidth: '90%',
  },
  toastError: {
    backgroundColor: colors.danger,
  },
  toastSuccess: {
    backgroundColor: colors.success,
  },
  toastText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    marginRight: Spacing.sm,
  },
  toastTextError: {
    color: colors.surface,
  },
  toastTextSuccess: {
    color: colors.surface,
  },
  closeButton: {
    padding: 2,
  },
}));
