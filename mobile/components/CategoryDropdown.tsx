import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { TOOL_CATEGORIES } from '@toolshare/shared';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useThemeColors, createThemedStyleSheet, Spacing, Radius } from '../constants/theme';

type CategoryDropdownProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function CategoryDropdown({
  value,
  onChange,
  placeholder = 'Kategorie wählen...',
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const Colors = useThemeColors();
  const styles = useStyles();

  const selected = TOOL_CATEGORIES.find((cat) => cat.value === value);

  const selectCategory = (categoryValue: string) => {
    onChange(categoryValue);
    setOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <ThemedText style={selected ? styles.triggerText : styles.placeholderText}>
          {selected?.label ?? placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setOpen(false)}
            accessibilityLabel="Kategorieauswahl schließen"
          />
          <View style={styles.sheet}>
            <ThemedText style={styles.sheetTitle}>Kategorie wählen</ThemedText>
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {TOOL_CATEGORIES.map((cat) => {
                const isActive = value === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.item, isActive && styles.itemActive]}
                    onPress={() => selectCategory(cat.value)}
                  >
                    <ThemedText style={[styles.itemText, isActive && styles.itemTextActive]}>
                      {cat.label}
                    </ThemedText>
                    {isActive && <Ionicons name="checkmark" size={20} color={Colors.brand} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  trigger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerText: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  list: {
    paddingHorizontal: Spacing.md,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.surfaceSoft,
  },
  itemActive: {
    backgroundColor: colors.brandSoft,
    borderRadius: Radius.sm,
  },
  itemText: {
    fontSize: 16,
    color: colors.text,
  },
  itemTextActive: {
    color: colors.brand,
    fontWeight: 'bold',
  },
}));
