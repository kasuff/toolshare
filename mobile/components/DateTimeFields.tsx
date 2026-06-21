import { useState, type ReactNode } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  TextInput,
  Pressable,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/theme';
import { ThemedText } from './ThemedText';
import {
  formatDateLabel,
  formatTimeLabel,
  parseLocalDateKey,
  parseLocalTimeKey,
  toLocalDateKey,
  toLocalTimeKey,
} from '../utils/dateTime';

type BaseFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type DateFieldProps = BaseFieldProps & {
  minimumDate?: Date;
  maximumDate?: Date;
};

type TimeFieldProps = BaseFieldProps & {
  baseDate?: string;
};

function PickerModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (Platform.OS !== 'ios') return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHeader}>
            <ThemedText type="defaultSemiBold">{title}</ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <ThemedText style={styles.modalDone}>Fertig</ThemedText>
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Datum wählen',
  minimumDate,
  maximumDate,
  disabled = false,
}: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = parseLocalDateKey(value) ?? new Date();

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type !== 'set' || !selectedDate) return;
      onChange(toLocalDateKey(selectedDate));
      return;
    }
    if (selectedDate) {
      onChange(toLocalDateKey(selectedDate));
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={Colors.textMuted}
          editable={!disabled}
        />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity
        style={[styles.inputButton, disabled && styles.inputDisabled]}
        onPress={() => setShowPicker(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <ThemedText style={[styles.inputButtonText, !value && styles.placeholderText]}>
          {formatDateLabel(value, placeholder)}
        </ThemedText>
        <Ionicons name="calendar-outline" size={18} color={Colors.brand} />
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <PickerModal visible={showPicker} title={label} onClose={() => setShowPicker(false)}>
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="spinner"
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            locale="de-DE"
          />
        </PickerModal>
      ) : showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
    </View>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Uhrzeit wählen',
  baseDate,
  disabled = false,
}: TimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = parseLocalTimeKey(value || '10:00', baseDate);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type !== 'set' || !selectedDate) return;
      onChange(toLocalTimeKey(selectedDate));
      return;
    }
    if (selectedDate) {
      onChange(toLocalTimeKey(selectedDate));
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={Colors.textMuted}
          editable={!disabled}
        />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity
        style={[styles.inputButton, disabled && styles.inputDisabled]}
        onPress={() => setShowPicker(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <ThemedText style={[styles.inputButtonText, !value && styles.placeholderText]}>
          {formatTimeLabel(value, placeholder)}
        </ThemedText>
        <Ionicons name="time-outline" size={18} color={Colors.brand} />
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <PickerModal visible={showPicker} title={label} onClose={() => setShowPicker(false)}>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display="spinner"
            onChange={handleChange}
            is24Hour
            locale="de-DE"
          />
        </PickerModal>
      ) : showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          display="default"
          onChange={handleChange}
          is24Hour
        />
      ) : null}
    </View>
  );
}

type DateTimeRangeFieldsProps = {
  startDateLabel?: string;
  startTimeLabel?: string;
  endDateLabel?: string;
  endTimeLabel?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  minimumDate?: Date;
  disabled?: boolean;
};

export function DateTimeRangeFields({
  startDateLabel = 'Datum',
  startTimeLabel = 'Uhrzeit',
  endDateLabel = 'Datum',
  endTimeLabel = 'Uhrzeit',
  startDate,
  startTime,
  endDate,
  endTime,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
  minimumDate,
  disabled = false,
}: DateTimeRangeFieldsProps) {
  return (
    <>
      <View style={styles.row}>
        <View style={styles.column}>
          <DateField
            label={startDateLabel}
            value={startDate}
            onChange={onStartDateChange}
            minimumDate={minimumDate}
            disabled={disabled}
          />
        </View>
        <View style={styles.column}>
          <TimeField
            label={startTimeLabel}
            value={startTime}
            onChange={onStartTimeChange}
            baseDate={startDate}
            disabled={disabled}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.column}>
          <DateField
            label={endDateLabel}
            value={endDate}
            onChange={onEndDateChange}
            minimumDate={parseLocalDateKey(startDate) ?? minimumDate}
            disabled={disabled}
          />
        </View>
        <View style={styles.column}>
          <TimeField
            label={endTimeLabel}
            value={endTime}
            onChange={onEndTimeChange}
            baseDate={endDate}
            disabled={disabled}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 14,
  },
  inputButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  inputButtonText: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
    marginRight: Spacing.xs,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  column: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalDone: {
    color: Colors.brand,
    fontWeight: '700',
  },
});
