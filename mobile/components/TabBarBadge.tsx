import { View, Text, StyleSheet } from 'react-native';
import { createThemedStyleSheet } from '../constants/theme';

type Props = {
  count: number;
};

export function TabBarBadge({ count }: Props) {
  const styles = useStyles();

  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  badge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
}));
