import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { api, AddressSuggestion } from '@toolshare/shared';
import { Spacing, Radius, useThemeColors, createThemedStyleSheet } from '../constants/theme';
import { ThemedText } from './ThemedText';

export type AddressFormFields = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

export const EMPTY_ADDRESS: AddressFormFields = {
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
};

export function toAddressPayload(fields: AddressFormFields) {
  return `${fields.street} ${fields.houseNumber}, ${fields.postalCode} ${fields.city}, ${fields.country}`
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseAddress(raw?: string): AddressFormFields {
  if (!raw) return { ...EMPTY_ADDRESS };

  const [streetPart = '', cityPart = '', countryPart = 'Deutschland'] = raw.split(',').map((part) => part.trim());
  const streetTokens = streetPart.split(/\s+/).filter(Boolean);
  const houseNumber = streetTokens.length > 1 ? streetTokens.pop() ?? '' : '';
  const cityTokens = cityPart.split(/\s+/).filter(Boolean);
  const postalCode = cityTokens.length > 1 ? cityTokens.shift() ?? '' : '';

  return {
    street: streetTokens.join(' '),
    houseNumber,
    postalCode,
    city: cityTokens.join(' '),
    country: countryPart || 'Deutschland',
  };
}

export function isAddressComplete(fields: AddressFormFields) {
  return Boolean(
    fields.street.trim() &&
      fields.houseNumber.trim() &&
      fields.postalCode.trim() &&
      fields.city.trim()
  );
}

function addressesEqual(a: AddressFormFields, b: AddressFormFields) {
  return (
    a.street === b.street &&
    a.houseNumber === b.houseNumber &&
    a.postalCode === b.postalCode &&
    a.city === b.city &&
    a.country === b.country
  );
}

const searchInputProps = Platform.select({
  web: { autoComplete: 'off' as const },
  default: { autoComplete: 'off' as const, importantForAutofill: 'no' as const },
});

export function AddressInput({
  value,
  onChange,
  label = 'Adresse',
  required = false,
  initialMode = 'automatic',
}: Props) {
  const [mode, setMode] = useState<'automatic' | 'manual'>(initialMode);
  const [fields, setFields] = useState(value);
  const [searchValue, setSearchValue] = useState(() =>
    value.street && value.city ? toAddressPayload(value) : ''
  );
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingSuggestion = useRef(false);
  const lastEmittedRef = useRef(value);
  const lastSelectedSearchValue = useRef<string | null>(null);
  const colors = useThemeColors();
  const styles = useStyles();

  useEffect(() => {
    if (addressesEqual(value, lastEmittedRef.current)) return;

    setFields(value);
    lastEmittedRef.current = value;
    if (value.street && value.city) {
      setSearchValue(toAddressPayload(value));
    } else if (!value.street && !value.city) {
      setSearchValue('');
    }
  }, [value]);

  const emitChange = useCallback(
    (next: AddressFormFields) => {
      lastEmittedRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  useEffect(() => {
    if (mode !== 'automatic' || searchValue.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (searchValue === lastSelectedSearchValue.current) {
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.suggestAddresses(searchValue);
        setSuggestions(results);
      } catch (e) {
        console.error('Address suggestion failed:', e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchValue, mode]);

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    isSelectingSuggestion.current = false;
    const next = {
      street: suggestion.street,
      houseNumber: suggestion.houseNumber,
      postalCode: suggestion.postalCode,
      city: suggestion.city,
      country: suggestion.country || 'Deutschland',
    };
    setFields(next);
    emitChange(next);
    lastSelectedSearchValue.current = suggestion.label;
    setSearchValue(suggestion.label);
    setSuggestions([]);
  };

  const updateField = (field: keyof AddressFormFields, fieldValue: string) => {
    setFields((prev) => {
      const next = { ...prev, [field]: fieldValue };
      emitChange(next);
      return next;
    });
  };

  const switchToAutomatic = () => {
    if (fields.street && fields.city) {
      setSearchValue(toAddressPayload(fields));
    }
    setMode('automatic');
  };

  const showDropdown = mode === 'automatic' && searchValue.trim().length >= 3 && searchValue !== lastSelectedSearchValue.current;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>
        {label} {required ? '*' : ''}
      </ThemedText>

      {mode === 'automatic' ? (
        <View style={styles.automaticContainer}>
          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.input}
              value={searchValue}
              onChangeText={(text) => {
                lastSelectedSearchValue.current = null;
                setSearchValue(text);
                const parsed = parseAddress(text);
                setFields(parsed);
                emitChange(parsed);
              }}
              placeholder="Adresse suchen..."
              placeholderTextColor={colors.textMuted}
              blurOnSubmit={false}
              autoCorrect={false}
              {...searchInputProps}
            />
            <ActivityIndicator
              style={[styles.loader, !loading && styles.loaderHidden]}
              size="small"
              color={colors.brand}
            />
          </View>

          {showDropdown && (
            <View style={styles.dropdown}>
              <ThemedText style={styles.dropdownHead}>Vorschläge:</ThemedText>
              {suggestions.length > 0 ? (
                <ScrollView style={styles.suggestionsScroll} keyboardShouldPersistTaps="always" nestedScrollEnabled>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={`${suggestion.label}-${index}`}
                      style={styles.suggestionItem}
                      onPressIn={() => {
                        isSelectingSuggestion.current = true;
                      }}
                      onPress={() => selectSuggestion(suggestion)}
                    >
                      <ThemedText style={styles.suggestionTitle}>{suggestion.label}</ThemedText>
                      <ThemedText style={styles.suggestionMeta}>
                        {suggestion.postalCode} {suggestion.city}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                !loading && <ThemedText style={styles.emptyText}>Keine Vorschläge gefunden.</ThemedText>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.toggleBtn} onPress={() => setMode('manual')}>
            <ThemedText style={styles.toggleBtnText}>Adresse manuell eingeben</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.manualContainer}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2 }]}>
              <TextInput
                style={styles.input}
                value={fields.street}
                onChangeText={(val) => updateField('street', val)}
                placeholder="Straße *"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                {...searchInputProps}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.sm }]}>
              <TextInput
                style={styles.input}
                value={fields.houseNumber}
                onChangeText={(val) => updateField('houseNumber', val)}
                placeholder="Nr. *"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                {...searchInputProps}
              />
            </View>
          </View>

          <View style={[styles.row, { marginTop: Spacing.sm }]}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                value={fields.postalCode}
                onChangeText={(val) => updateField('postalCode', val)}
                placeholder="PLZ *"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                keyboardType="number-pad"
                {...searchInputProps}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 2, marginLeft: Spacing.sm }]}>
              <TextInput
                style={styles.input}
                value={fields.city}
                onChangeText={(val) => updateField('city', val)}
                placeholder="Ort *"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                {...searchInputProps}
              />
            </View>
          </View>

          <TextInput
            style={[styles.input, { marginTop: Spacing.sm }]}
            value={fields.country}
            onChangeText={(val) => updateField('country', val)}
            placeholder="Land"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            {...searchInputProps}
          />

          <TouchableOpacity style={styles.toggleBtn} onPress={switchToAutomatic}>
            <ThemedText style={styles.toggleBtnText}>Automatische Adresssuche verwenden</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

type Props = {
  value: AddressFormFields;
  onChange: (value: AddressFormFields) => void;
  label?: string;
  required?: boolean;
  initialMode?: 'automatic' | 'manual';
};

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    marginBottom: Spacing.lg,
    position: 'relative',
    zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    color: colors.text,
  },
  automaticContainer: {
    position: 'relative',
    zIndex: 2,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  loader: {
    position: 'absolute',
    right: Spacing.md,
  },
  loaderHidden: {
    opacity: 0,
  },
  dropdown: {
    marginTop: Spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    padding: Spacing.sm,
  },
  dropdownHead: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: Spacing.xs,
    fontWeight: 'bold',
  },
  suggestionsScroll: {
    maxHeight: 180,
  },
  suggestionItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  suggestionMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyText: {
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  toggleBtn: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  toggleBtnText: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: 'bold',
  },
  manualContainer: {},
  row: {
    flexDirection: 'row',
  },
  inputGroup: {},
}));
