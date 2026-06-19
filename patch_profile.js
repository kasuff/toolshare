const fs = require('fs');
const path = 'mobile/app/(tabs)/profile.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { api } from '@toolshare/shared';",
  "import { api, SystemSetting } from '@toolshare/shared';\nimport { router } from 'expo-router';"
);

content = content.replace(
  "const { currentUser, logout, updateProfile } = useAuth();",
  "const { currentUser, logout, updateProfile, token } = useAuth();"
);

content = content.replace(
  "const [error, setError] = useState('');",
  `const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [systemRules, setSystemRules] = useState<SystemSetting[]>([]);`
);

content = content.replace(
  "useEffect(() => {",
  `useEffect(() => {
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

  useEffect(() => {`
);

content = content.replace(
  "<TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>",
  `{systemRules.length > 0 && (
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

          <View style={[styles.card, { padding: 0 }]}>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/impressum')}>
              <ThemedText style={styles.linkText}>Impressum</ThemedText>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            <View style={{height: 1, backgroundColor: Colors.border}} />
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/datenschutz')}>
              <ThemedText style={styles.linkText}>Datenschutz</ThemedText>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>`
);

content = content.replace(
  "<AddressInput value={address} onChange={setAddress} label=\"Adresse\" required />",
  `<AddressInput value={address} onChange={setAddress} label="Adresse" required />
            
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
            <View style={styles.divider} />`
);

content = content.replace(
  "successText: {",
  `ruleRow: {
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
  successText: {`
);

fs.writeFileSync(path, content, 'utf8');
