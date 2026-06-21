import { Modal, StyleSheet, Image, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';

type Props = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
};

export function ImageLightbox({ uri, visible, onClose }: Props) {
  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Vorschau schließen">
          <Ionicons name="close" size={28} color="#ffffff" />
        </TouchableOpacity>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.md,
    zIndex: 2,
    padding: Spacing.xs,
  },
  image: {
    width: '100%',
    height: '80%',
  },
});
