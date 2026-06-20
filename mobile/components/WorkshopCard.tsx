import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Workshop } from '@toolshare/shared';
import { Colors, Radius, Spacing } from '../constants/theme';
import { ThemedText } from './ThemedText';

interface Props {
  workshop: Workshop;
  onPress: () => void;
}

export function WorkshopCard({ workshop, onPress }: Props) {
  const imageUrl = workshop.imageUrls?.[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </View>
      <View style={styles.content}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>{workshop.name}</ThemedText>
        <ThemedText type="muted" numberOfLines={2} style={styles.description}>
          {workshop.description}
        </ThemedText>
        <View style={styles.footer}>
          <ThemedText type="muted" style={styles.category}>Werkstatt</ThemedText>
          <ThemedText style={styles.details}>Details →</ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: {
    height: 220,
    width: '100%',
    backgroundColor: Colors.bg,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: Colors.border,
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
    borderTopColor: Colors.border,
  },
  category: {
    textTransform: 'uppercase',
    fontSize: 12,
  },
  details: {
    color: Colors.brand,
    fontWeight: 'bold',
    fontSize: 14,
  }
});
