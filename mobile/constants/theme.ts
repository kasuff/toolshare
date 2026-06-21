import { useColorScheme, StyleSheet } from 'react-native';

export const LightColors = {
  brand: '#d14700',
  brandStrong: '#b83e00',
  brandSoft: '#fff4ed',
  text: '#2D2D2D',
  textMuted: '#6B7280',
  surface: '#FFFFFF',
  surfaceSoft: '#f9fafb',
  border: '#E5E7EB',
  success: '#10B981',
  danger: '#d63b3b',
  warning: '#92400e',
  bg: '#f6f8fb',
  highlight: '#e65c00'
};

export const DarkColors = {
  brand: '#ff8533',
  brandStrong: '#ffa366',
  brandSoft: '#2c1508',
  text: '#F3F4F6',
  textMuted: '#D1D5DB',
  surface: '#1F2937',
  surfaceSoft: '#111827',
  border: '#374151',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
  bg: '#111827',
  highlight: '#ffb88c'
};

// Legacy fallback
export const Colors = LightColors;

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkColors : LightColors;
}

export function createThemedStyleSheet<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: typeof LightColors) => T
): () => T {
  return () => {
    const colors = useThemeColors();
    return factory(colors);
  };
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
};
