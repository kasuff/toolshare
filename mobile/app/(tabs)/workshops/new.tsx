import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, BackHandler, Pressable } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, TOOL_CATEGORIES } from '@toolshare/shared';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Spacing, Radius } from '../../../constants/theme';
import { ThemedText } from '../../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { AddressInput, AddressFormFields, EMPTY_ADDRESS, isAddressComplete, toAddressPayload } from '../../../components/AddressInput';
import { ImageLightbox } from '../../../components/ImageLightbox';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../../../hooks/useToast';

const MAX_WORKSHOP_PHOTOS = 3;
const ADDRESS_VALIDATION_ERROR =
  'Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.';

const WORKSHOP_EXTRAS = [
  { value: "handwerkzeug", label: "Handwerkzeug", icon: "hammer-outline" },
  { value: "3d-drucker", label: "3D-Drucker", icon: "print-outline" },
  { value: "starkstrom", label: "Starkstrom", icon: "flash-outline" },
  { value: "wlan", label: "WLAN", icon: "wifi-outline" },
  { value: "ups-tee", label: "Kaffee & Tee", icon: "cafe-outline" },
  { value: "anlieferung", label: "Anlieferung", icon: "car-outline" },
  { value: "werkstube", label: "Werkstube", icon: "construct-outline" },
  { value: "parkplatz", label: "Parkplatz", icon: "car-sport-outline" }
] as const;



export default function NewWorkshopScreen() {
  const { token } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState<AddressFormFields>({ ...EMPTY_ADDRESS });
  const [maxCapacity, setMaxCapacity] = useState('2');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [extras, setExtras] = useState<string[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<Array<{ name: string; category: string }>>([]);
  const [newToolName, setNewToolName] = useState('');
  const [newToolCategory, setNewToolCategory] = useState(TOOL_CATEGORIES[0]?.value ?? 'sonstiges');
  const [isToolCatDropdownOpen, setIsToolCatDropdownOpen] = useState(false);
  


  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pushToast } = useToast();
  const returnToPath =
    typeof returnTo === 'string'
      ? returnTo
      : Array.isArray(returnTo)
        ? returnTo[0]
        : undefined;

  const navigateBack = useCallback(() => {
    if (returnToPath) {
      router.replace(returnToPath as '/offers');
      return;
    }
    router.back();
  }, [returnToPath]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!returnToPath) {
          return false;
        }
        navigateBack();
        return true;
      });
      return () => subscription.remove();
    }, [navigateBack, returnToPath])
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

  const addImage = (nextImage: string) => {
    if (selectedImages.includes(nextImage)) return;
    if (selectedImages.length >= MAX_WORKSHOP_PHOTOS) {
      pushToast(`Maximal ${MAX_WORKSHOP_PHOTOS} Fotos erlaubt.`, 'error');
      return;
    }
    setSelectedImages((prev) => [...prev, nextImage]);
  };

  const takePhoto = async () => {
    if (selectedImages.length >= MAX_WORKSHOP_PHOTOS) {
      pushToast(`Maximal ${MAX_WORKSHOP_PHOTOS} Fotos erlaubt.`, 'error');
      return;
    }
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
      if (imageData) addImage(imageData);
      else pushToast('Bild konnte nicht verarbeitet werden. Bitte erneut versuchen.', 'error');
    }
  };

  const pickImageFromGallery = async () => {
    if (selectedImages.length >= MAX_WORKSHOP_PHOTOS) {
      pushToast(`Maximal ${MAX_WORKSHOP_PHOTOS} Fotos erlaubt.`, 'error');
      return;
    }
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
      if (imageData) addImage(imageData);
      else pushToast('Bild konnte nicht verarbeitet werden. Bitte erneut versuchen.', 'error');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };



  const toggleExtra = (value: string) => {
    if (extras.includes(value)) {
      setExtras(extras.filter(e => e !== value));
    } else {
      setExtras([...extras, value]);
    }
  };

  const addEquipmentItem = () => {
    const nameTrimmed = newToolName.trim();
    if (!nameTrimmed) return;
    setEquipmentItems([...equipmentItems, { name: nameTrimmed, category: newToolCategory }]);
    setNewToolName('');
  };

  const removeEquipmentItem = (index: number) => {
    setEquipmentItems(equipmentItems.filter((_, i) => i !== index));
  };



  const submit = async () => {
    if (!name.trim()) return pushToast('Bitte gib einen Namen ein.', 'error');
    if (description.trim().length < 5) return pushToast('Die Beschreibung muss mindestens 5 Zeichen lang sein.', 'error');
    const addressStr = toAddressPayload(address);
    if (!isAddressComplete(address)) return pushToast('Bitte gib eine vollständige Werkstattadresse an.', 'error');
    setIsSubmitting(true);
    try {
      const validation = await api.validateAddress(addressStr);
      if (!validation.isValid) {
        pushToast(ADDRESS_VALIDATION_ERROR, 'error');
        return;
      }
      const normalizedLocation = validation.normalizedAddress?.trim() || addressStr;
      


      await api.createWorkshop({
        name: name.trim(),
        description: description.trim(),
        location: normalizedLocation,
        maxCapacity: parseInt(maxCapacity) || 1,
        extras,
        equipmentItems,
        imageUrls: selectedImages,
        slots: []
      }, token!);

      router.replace('/offers');
      pushToast('Werkstatt erfolgreich eingestellt.', 'success');
    } catch (err: any) {
      pushToast(err.message || 'Werkstatt konnte nicht angelegt werden.', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
          <ThemedText type="title">Werkstatt einstellen</ThemedText>
        </View>



        <View style={styles.field}>
          <ThemedText style={styles.label}>Bilder</ThemedText>
          <ThemedText type="muted" style={{ marginBottom: Spacing.sm }}>
            Füge bis zu {MAX_WORKSHOP_PHOTOS} Fotos deiner Werkstatt hinzu (Kamera oder Galerie).
          </ThemedText>
          <ThemedText type="muted" style={styles.imageCount}>
            {selectedImages.length} von {MAX_WORKSHOP_PHOTOS} Fotos
          </ThemedText>

          {selectedImages.length > 0 ? (
            <View style={styles.imageGrid}>
              {selectedImages.map((imageUri, index) => (
                <View key={`${imageUri}-${index}`} style={styles.imageTile}>
                  <Pressable onPress={() => setPreviewImage(imageUri)}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  </Pressable>
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="images-outline" size={28} color={Colors.textMuted} />
              <ThemedText type="muted">Noch keine Bilder ausgewählt</ThemedText>
            </View>
          )}

          {selectedImages.length < MAX_WORKSHOP_PHOTOS ? (
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
          ) : null}
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Name *</ThemedText>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="z.B. Garagen-Werkstatt"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Beschreibung *</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Zustand, Ausstattung..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <AddressInput value={address} onChange={setAddress} label="Adresse" required initialMode="manual" />

        <View style={styles.field}>
          <ThemedText style={styles.label}>Maximale Personenzahl *</ThemedText>
          <TextInput
            style={styles.input}
            value={maxCapacity}
            onChangeText={setMaxCapacity}
            placeholder="z.B. 2"
            keyboardType="number-pad"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Ausstattung (Equipment builder) */}
        <View style={[styles.field, isToolCatDropdownOpen && { zIndex: 10 }]}>
          <ThemedText style={styles.label}>Ausstattung</ThemedText>
          <ThemedText type="muted" style={{ marginBottom: Spacing.sm }}>
            Füge die Werkzeuge hinzu, die in deiner Werkstatt vorhanden sind.
          </ThemedText>

          {equipmentItems.length > 0 && (
            <View style={styles.equipmentList}>
              {equipmentItems.map((item, index) => (
                <View key={index} style={styles.equipmentItem}>
                  <ThemedText style={{ flex: 1, fontSize: 14 }}>
                    <ThemedText style={{ fontWeight: 'bold' }}>{item.name}</ThemedText> · {TOOL_CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                  </ThemedText>
                  <TouchableOpacity onPress={() => removeEquipmentItem(index)}>
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.equipmentInputBox}>
            <TextInput
              style={styles.input}
              value={newToolName}
              onChangeText={setNewToolName}
              placeholder="Werkzeugname (z.B. Bosch Akkuschrauber)"
              placeholderTextColor={Colors.textMuted}
            />
            
            {/* Category Dropdown inside equipment builder */}
            <View style={{ marginTop: Spacing.sm, position: 'relative' }}>
              <TouchableOpacity 
                style={styles.dropdownTrigger} 
                onPress={() => setIsToolCatDropdownOpen(!isToolCatDropdownOpen)}
              >
                <ThemedText style={styles.dropdownTriggerText}>
                  {TOOL_CATEGORIES.find(cat => cat.value === newToolCategory)?.label || 'Kategorie wählen...'}
                </ThemedText>
                <Ionicons name={isToolCatDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              {isToolCatDropdownOpen && (
                <View style={styles.dropdownList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                    {TOOL_CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[
                          styles.dropdownItem,
                          newToolCategory === cat.value && styles.dropdownItemActive
                        ]}
                        onPress={() => {
                          setNewToolCategory(cat.value);
                          setIsToolCatDropdownOpen(false);
                        }}
                      >
                        <ThemedText style={[
                          styles.dropdownItemText,
                          newToolCategory === cat.value && styles.dropdownItemTextActive
                        ]}>
                          {cat.label}
                        </ThemedText>
                        {newToolCategory === cat.value && (
                          <Ionicons name="checkmark" size={18} color={Colors.brand} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.addEquipmentBtn} onPress={addEquipmentItem}>
              <Ionicons name="add" size={18} color={Colors.brand} />
              <ThemedText style={styles.addEquipmentBtnText}>Werkzeug hinzufügen</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Extras (Grid of check-chips) */}
        <View style={styles.field}>
          <ThemedText style={styles.label}>Extras</ThemedText>
          <ThemedText type="muted" style={{ marginBottom: Spacing.md }}>
            Wähle optionale Zusatzmerkmale deiner Werkstatt.
          </ThemedText>
          <View style={styles.extrasGrid}>
            {WORKSHOP_EXTRAS.map(extra => {
              const isSelected = extras.includes(extra.value);
              return (
                <TouchableOpacity
                  key={extra.value}
                  style={[styles.extraChip, isSelected && styles.extraChipSelected]}
                  onPress={() => toggleExtra(extra.value)}
                >
                  <Ionicons 
                    name={extra.icon as any} 
                    size={20} 
                    color={isSelected ? Colors.brand : Colors.textMuted} 
                    style={{ marginRight: 6 }}
                  />
                  <ThemedText style={[styles.extraChipText, isSelected && styles.extraChipTextSelected]}>
                    {extra.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>



        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
          onPress={submit} 
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <ThemedText style={styles.submitButtonText}>Werkstatt einstellen</ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ImageLightbox
        uri={previewImage}
        visible={previewImage !== null}
        onClose={() => setPreviewImage(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
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
  section: {
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  imagePlaceholder: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  imageCount: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  imageActions: {
    gap: Spacing.sm,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 102, 0, 0.05)',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  imageButtonText: {
    color: Colors.brand,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: Colors.brand,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  slotEditor: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  slotInputWrapper: {
    flex: 0.48,
  },
  miniLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(49, 196, 141, 0.1)',
  },
  addSlotBtnText: {
    color: Colors.brand,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  slotsList: {
    marginBottom: Spacing.md,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  dropdownTrigger: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownTriggerText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownList: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.surfaceSoft,
  },
  dropdownItemActive: {
    backgroundColor: Colors.brandSoft,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownItemTextActive: {
    color: Colors.brand,
    fontWeight: 'bold',
  },
  equipmentInputBox: {
    backgroundColor: Colors.surfaceSoft,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  equipmentList: {
    marginBottom: Spacing.md,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  addEquipmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.brandSoft,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 102, 0, 0.05)',
  },
  addEquipmentBtnText: {
    color: Colors.brand,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  extrasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  extraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  extraChipSelected: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  extraChipText: {
    fontSize: 14,
    color: Colors.text,
  },
  extraChipTextSelected: {
    color: Colors.brand,
    fontWeight: 'bold',
  },
});
