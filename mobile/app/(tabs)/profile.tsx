import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { ThemedText } from '../../components/ThemedText';
import { useAuth } from '../../hooks/useAuth';
import { api, SystemSetting } from '@toolshare/shared';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AddressInput,
  AddressFormFields,
  isAddressComplete,
  parseAddress,
  toAddressPayload,
} from '../../components/AddressInput';

const ADDRESS_VALIDATION_ERROR =
  'Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.';

export default function ProfileScreen() {
  const { currentUser, logout, updateProfile, token } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [address, setAddress] = useState<AddressFormFields>(() => parseAddress(currentUser?.address));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [systemRules, setSystemRules] = useState<SystemSetting[]>([]);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (token) {
      api.getSystemSettings(token).then(setSystemRules).catch(console.error);
    }
  }, [token]);

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Bitte alle Passwortfelder ausfüllen.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Das neue Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Die beiden neuen Passwörter stimmen nicht überein.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Das neue Passwort muss sich vom aktuellen unterscheiden.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword, token!);
      setSuccess('Passwort wurde geändert.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Passwort konnte nicht geändert werden.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    if (currentUser && !isEditing) {
      setName(currentUser.name);
      setAddress(parseAddress(currentUser.address));
    }
  }, [currentUser, isEditing]);

  useEffect(() => {
    if (!currentUser?.address) return;

    void api.validateAddress(currentUser.address).then((validation) => {
      if (!validation.normalizedParts) return;
      setAddress({
        street: validation.normalizedParts.street,
        houseNumber: validation.normalizedParts.houseNumber,
        postalCode: validation.normalizedParts.postalCode,
        city: validation.normalizedParts.city,
        country: validation.normalizedParts.country || 'Deutschland',
      });
    });
  }, [currentUser?.address]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const nextName = name.trim();
    const nextAddress = toAddressPayload(address);

    if (nextName.length < 2) {
      setError('Name muss mindestens 2 Zeichen haben.');
      return;
    }
    if (!isAddressComplete(address)) {
      setError('Bitte Straße, Hausnummer, PLZ und Ort vollständig ausfüllen.');
      return;
    }

    setIsSaving(true);
    try {
      const validation = await api.validateAddress(nextAddress);
      if (!validation.isValid) {
        setError(ADDRESS_VALIDATION_ERROR);
        return;
      }
      await updateProfile({ name: nextName, address: nextAddress });
      setSuccess('Profil erfolgreich aktualisiert.');
      setTimeout(() => {
        setIsEditing(false);
        setSuccess('');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentUser) {
      setName(currentUser.name);
      setAddress(parseAddress(currentUser.address));
    }
    setError('');
    setSuccess('');
    setIsEditing(false);
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="always">
      <View style={styles.header}>
        <ThemedText type="title">Profil</ThemedText>
        <ThemedText type="muted" style={styles.subtitle}>Deine Kontoeinstellungen</ThemedText>
      </View>

      {!isEditing ? (
        // VIEW MODE
        <View style={styles.profileBox}>
          <View style={styles.card}>
            <View style={styles.avatarRow}>
              <View style={styles.largeAvatar}>
                <ThemedText style={styles.largeAvatarText}>
                  {currentUser?.name ? currentUser.name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('') : 'TS'}
                </ThemedText>
              </View>
              <View style={styles.avatarMeta}>
                <ThemedText type="defaultSemiBold" style={styles.profileName}>{currentUser?.name}</ThemedText>
                <ThemedText type="muted">{currentUser?.email}</ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={Colors.brand} style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <ThemedText type="muted" style={styles.infoLabel}>Adresse</ThemedText>
                <ThemedText style={styles.infoValue}>{currentUser?.address || 'Keine Adresse angegeben'}</ThemedText>
              </View>
            </View>
          </View>

          {systemRules.length > 0 && (
            <View style={styles.card}>
              <ThemedText type="defaultSemiBold" style={styles.editCardTitle}>Systemregeln</ThemedText>
              {systemRules.map(rule => (
                <View key={rule.key} style={styles.ruleRow}>
                  <ThemedText style={{flex: 1}}>{rule.label}</ThemedText>
                  <ThemedText type="defaultSemiBold">{rule.value} {rule.unit}</ThemedText>
                </View>
              ))}
            </View>
          )}


          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={20} color={Colors.surface} style={styles.btnIcon} />
            <ThemedText style={styles.editButtonText}>Profil bearbeiten</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} style={styles.btnIcon} />
            <ThemedText style={styles.logoutText}>Abmelden</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        // EDIT MODE
        <View style={styles.profileBox}>
          <View style={styles.card}>
            <ThemedText type="defaultSemiBold" style={styles.editCardTitle}>Profil bearbeiten</ThemedText>
            
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
            {success ? <ThemedText style={styles.successText}>{success}</ThemedText> : null}

            {/* Name field */}
            <View style={styles.field}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.divider} />
            <AddressInput value={address} onChange={setAddress} label="Adresse" required />
            
            <View style={styles.divider} />
            <ThemedText type="defaultSemiBold" style={{marginBottom: Spacing.md}}>Passwort ändern</ThemedText>
            
            <View style={styles.field}>
              <ThemedText style={styles.label}>Aktuelles Passwort</ThemedText>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Aktuelles Passwort"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Neues Passwort</ThemedText>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Mindestens 8 Zeichen"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <ThemedText style={styles.label}>Neues Passwort wiederholen</ThemedText>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Neues Passwort erneut eingeben"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <TouchableOpacity 
              style={[styles.saveButton, {marginBottom: Spacing.md}, isChangingPassword && { opacity: 0.7 }]} 
              onPress={handleChangePassword} 
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Passwort ändern</ThemedText>
              )}
            </TouchableOpacity>
            <View style={styles.divider} />
          </View>

          <View style={styles.editBtnRow}>
            <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isSaving}>
              <ThemedText style={styles.cancelButtonText}>Abbrechen</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{height: 100}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  profileBox: {
    flex: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    position: 'relative',
    zIndex: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  largeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  largeAvatarText: {
    color: Colors.surface,
    fontWeight: 'bold',
    fontSize: 22,
  },
  avatarMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 2,
  },
  editButton: {
    flexDirection: 'row',
    backgroundColor: Colors.brand,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  editButtonText: {
    color: Colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: Colors.danger,
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnIcon: {
    marginRight: Spacing.sm,
  },
  editCardTitle: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  field: {
    marginBottom: Spacing.md,
    position: 'relative',
  },
  label: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.bg,
  },
  editBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: Colors.brand,
    flex: 0.48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonText: {
    color: Colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 0.48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    color: Colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: Colors.danger,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceSoft,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  linkText: {
    fontSize: 16,
    color: Colors.text,
  },
  successText: {
    color: Colors.success,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.md,
  }
});
