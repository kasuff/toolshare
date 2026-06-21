import { View, Image, TouchableOpacity } from 'react-native';
import { Tool } from '@toolshare/shared';
import { Radius, Spacing, createThemedStyleSheet } from '../constants/theme';
import { ThemedText } from './ThemedText';

interface Props {
  tool: Tool;
  onPress: () => void;
}

export function ToolCard({ tool, onPress }: Props) {
  const styles = useStyles();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {tool.imageUrl ? (
          <Image source={{ uri: tool.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </View>
      <View style={styles.content}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>{tool.name}</ThemedText>
        <ThemedText type="muted" numberOfLines={2} style={styles.description}>
          {tool.description}
        </ThemedText>
        <View style={styles.footer}>
          <ThemedText type="muted" style={styles.category}>{tool.category}</ThemedText>
          <ThemedText style={styles.details}>Details →</ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: colors.border,
  },
  content: {
    padding: Spacing.md,
  },
  description: {
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  category: {
    textTransform: 'uppercase',
    fontSize: 12,
  },
  details: {
    color: colors.brand,
    fontWeight: 'bold',
    fontSize: 14,
  }
}));
