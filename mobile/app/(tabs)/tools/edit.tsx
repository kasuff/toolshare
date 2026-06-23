import { useCallback, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Pressable, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, DEFAULT_PLACEHOLDER_IMAGE } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { useThemeColors, createThemedStyleSheet, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { AddressInput, AddressFormFields, EMPTY_ADDRESS, isAddressComplete, toAddressPayload, parseAddress } from '../../../components/AddressInput';
import { ImageLightbox } from '../../../components/ImageLightbox';
import * as ImagePicker from 'expo-image-picker';
import { BackHandler } from 'react-native';
import { useToast } from '../../../hooks/useToast';
import { FormErrorsSummary } from '../../../components/FormErrorText';
import { CategoryDropdown } from '../../../components/CategoryDropdown';
import { getErrorMessage } from '../../../utils/errors';

const ADDRESS_VALIDATION_ERROR =
  'Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.';

export default function EditToolScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState<AddressFormFields>({ ...EMPTY_ADDRESS });
  const [pickupLocationNote, setPickupLocationNote] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const navigateBack = useCallback(() => {
    router.back();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        navigateBack();
        return true;
      });
      return () => subscription.remove();
    }, [navigateBack])
  );

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!id || !token) return;
        try {
          const tool = await api.getToolById(id, token);
          setName(tool.name);
          setDescription(tool.description);
          setCategory(tool.category);
          setAddress(parseAddress(tool.pickupLocation));
          setPickupLocationNote(tool.pickupLocationNote || '');
          if (tool.imageUrl && tool.imageUrl !== DEFAULT_PLACEHOLDER_IMAGE) {
            setSelectedImage(tool.imageUrl);
          }
        } catch {
          pushToast('Fehler beim Laden des Werkzeugs', 'error');
        } finally {
          setIsLoading(false);
        }
      }
      load();
    }, [id, token, pushToast])
  );

  const uriToDataUrl = async (uri: string, mimeType: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result.startsWith('data:') ? result : `data:${mimeType};base64,${result}`);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const extractImageData = async (asset: ImagePicker.ImagePickerAsset): Promise<string | null> => {
    if (asset.base64) {
      const mimeType = asset.mimeType || 'image/jpeg';
      return `data:${mimeType};base64,${asset.base64}`;
    }

    if (asset.uri) {
      const mimeType = asset.mimeType || 'image/jpeg';
      return uriToDataUrl(asset.uri, mimeType);
    }

    return null;
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      pushToast('Bitte erlaube den Kamerazugriff, um ein Bild aufzunehmen.', 'error');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const imageData = await extractImageData(result.assets[0]);
      if (imageData) setSelectedImage(imageData);
      else pushToast('Bild konnte nicht verarbeitet werden. Bitte erneut versuchen.', 'error');
    }
  };

  const pickImageFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      pushToast('Bitte erlaube den Zugriff auf deine Galerie.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const imageData = await extractImageData(result.assets[0]);
      if (imageData) setSelectedImage(imageData);
      else pushToast('Bild konnte nicht verarbeitet werden. Bitte erneut versuchen.', 'error');
    }
  };

  const submit = async () => {
    setApiError(null);
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Bitte gib einen Namen ein.';
    if (description.trim().length < 5) newErrors.description = 'Die Beschreibung muss mindestens 5 Zeichen lang sein.';
    if (!category) newErrors.category = 'Bitte wähle eine Kategorie.';
    const addressStr = toAddressPayload(address);
    if (!isAddressComplete(address)) newErrors.address = 'Bitte gib einen vollständigen Abholort an.';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const validation = await api.validateAddress(addressStr);
      if (!validation.isValid) {
        setErrors({ address: ADDRESS_VALIDATION_ERROR });
        setIsSubmitting(false);
        return;
      }
      const normalizedLocation = validation.normalizedAddress?.trim() || addressStr;

      await api.updateTool(id!, {
        name: name.trim(),
        description: description.trim(),
        category,
        pickupLocation: normalizedLocation,
        pickupLocationNote: pickupLocationNote.trim() || undefined,
        imageUrl: selectedImage || DEFAULT_PLACEHOLDER_IMAGE,
      }, token!);

      router.back();
    } catch (err) {
      setApiError(getErrorMessage(err, 'Werkzeug konnte nicht angelegt werden.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Werkzeug löschen",
      "Möchtest du dieses Werkzeug wirklich löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        { 
          text: "Löschen", 
          style: "destructive",
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await api.deleteTool(id!, token!);
              router.back();
            } catch (err) {
              setApiError(getErrorMessage(err, 'Werkzeug konnte nicht gelöscht werden.'));
            } finally {setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={navigateBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <ThemedText type="title">Werkzeug bearbeiten</ThemedText>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.brand} style={{ marginTop: Spacing.xl }} />
        ) : (
          <>



        <View style={styles.field}>
          <ThemedText style={styles.label}>Bild</ThemedText>
          {selectedImage ? (
            <View style={styles.imageGrid}>
              <View style={styles.imageTile}>
                <Pressable onPress={() => setPreviewImage(selectedImage)}>
                  <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                </Pressable>
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
              <ThemedText type="muted">Noch kein Bild ausgewählt</ThemedText>
            </View>
          )}
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={18} color={Colors.brand} />
              <ThemedText style={styles.imageButtonText}>Foto aufnehmen</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageButton} onPress={pickImageFromGallery}>
              <Ionicons name="images-outline" size={18} color={Colors.brand} />
              <ThemedText style={styles.imageButtonText}>Aus Galerie wählen</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Name *</ThemedText>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="z.B. Akku-Bohrmaschine"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Beschreibung *</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Zustand, Lieferumfang, Besonderheiten..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Kategorie *</ThemedText>
          <CategoryDropdown value={category} onChange={setCategory} />
        </View>

        <View style={styles.field}>
          <AddressInput value={address} onChange={setAddress} label="Abholort" required />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Hinweis zur Abholung</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={pickupLocationNote}
            onChangeText={setPickupLocationNote}
            placeholder="z.B. Klingeln bei Thomas..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        <FormErrorsSummary errors={errors} error={apiError} style={{ marginBottom: Spacing.md }} />

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.deleteButton, isSubmitting && styles.submitButtonDisabled]} 
            onPress={handleDelete} 
            disabled={isSubmitting}
          >
            <ThemedText style={styles.deleteButtonText}>Löschen</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
            onPress={submit} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <ThemedText style={styles.submitButtonText}>Speichern</ThemedText>
            )}
          </TouchableOpacity>
        </View>
        </>
        )}
      </ScrollView>

      <ImageLightbox
        uri={previewImage}
        visible={previewImage !== null}
        onClose={() => setPreviewImage(null)}
      />
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backButton: {
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  imageTile: {
    width: '48%',
    position: 'relative',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: Radius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  imagePlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    backgroundColor: colors.surface,
  },
  imageActions: {
    gap: Spacing.sm,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: Radius.md,
    backgroundColor: colors.brandSoft,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  imageButtonText: {
    color: colors.brand,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.brand,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: 'bold',
    fontSize: 16,
  },
}));
