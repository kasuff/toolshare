import { Text, TextProps } from 'react-native';
import { useThemeColors, createThemedStyleSheet } from '../constants/theme';

interface ThemedTextProps extends TextProps {
  type?: 'default' | 'title' | 'subtitle' | 'defaultSemiBold' | 'muted';
}

export function ThemedText({
  style,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const colors = useThemeColors();
  const styles = useStyles();

  return (
    <Text
      style={[
        { color: colors.text },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'muted' ? styles.muted : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
}));
