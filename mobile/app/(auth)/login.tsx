import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@toolshare/shared';
import { useAuth } from '../../hooks/useAuth';
import { ThemedText } from '../../components/ThemedText';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { FormErrorText } from '../../components/FormErrorText';
import {
  AddressInput,
  AddressFormFields,
  isAddressComplete,
  toAddressPayload,
  EMPTY_ADDRESS,
} from '../../components/AddressInput';

export default function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState<AddressFormFields>({ ...EMPTY_ADDRESS });
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const router = useRouter();

  const repeatPasswordTouched = repeatPassword.length > 0;
  const passwordsMatch = password.length > 0 && password === repeatPassword;
  const passwordsMismatch = repeatPasswordTouched && password !== repeatPassword;

  const handleSubmit = async () => {
    if (isLoading) return;
    setError(null);
    try {
      setIsLoading(true);
      if (isRegister) {
        if (passwordsMismatch) {
          throw new Error('Passwörter stimmen nicht überein.');
        }
        if (!isAddressComplete(address)) {
          throw new Error('Bitte Straße, Hausnummer, PLZ und Ort vollständig ausfüllen.');
        }
        const payloadAddress = toAddressPayload(address);
        const validation = await api.validateAddress(payloadAddress);
        if (!validation.isValid) {
          throw new Error('Adresse konnte nicht verifiziert werden. Bitte wähle eine vorgeschlagene Adresse.');
        }
        const { accessToken } = await api.register({
          email,
          password,
          name,
          address: payloadAddress,
        });
        await login(accessToken);
      } else {
        const { accessToken } = await api.login(email, password);
        await login(accessToken);
      }
      router.replace('/tools');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentifizierung fehlgeschlagen');
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.card}>
          <ThemedText type="title" style={styles.title}>ToolShare</ThemedText>
          <ThemedText type="muted" style={styles.subtitle}>
            {isRegister ? 'Konto erstellen' : 'Bitte melde dich an'}
          </ThemedText>

          <View style={styles.form}>
            <ThemedText style={styles.label}>E-Mail *</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="E-Mail"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            {isRegister && (
              <>
                <ThemedText style={styles.label}>Name *</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                />

                <AddressInput
                  value={address}
                  onChange={setAddress}
                  label="Adresse"
                  required
                />
              </>
            )}

            <ThemedText style={styles.label}>
              {isRegister ? 'Passwort (mind. 8 Zeichen) *' : 'Passwort *'}
            </ThemedText>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder={isRegister ? 'Passwort (mind. 8 Zeichen)' : 'Passwort'}
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={isRegister ? 'new-password' : 'password'}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {isRegister && (
              <>
                <ThemedText style={styles.label}>Passwort wiederholen *</ThemedText>
                <View style={[styles.passwordContainer, passwordsMismatch && styles.inputInvalid]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Passwort wiederholen"
                    placeholderTextColor={Colors.textMuted}
                    value={repeatPassword}
                    onChangeText={setRepeatPassword}
                    secureTextEntry={!showRepeatPassword}
                    autoComplete="new-password"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowRepeatPassword(!showRepeatPassword)}
                    accessibilityLabel={showRepeatPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                  >
                    <Ionicons
                      name={showRepeatPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {passwordsMismatch && (
                  <ThemedText style={styles.fieldError}>Passwörter stimmen nicht überein.</ThemedText>
                )}
                {passwordsMatch && repeatPasswordTouched && (
                  <ThemedText style={styles.fieldSuccess}>Passwörter stimmen überein.</ThemedText>
                )}
              </>
            )}

            <FormErrorText error={error} style={{ marginBottom: Spacing.sm }} />

            <TouchableOpacity
              style={[
                styles.button,
                (isLoading || (isRegister && passwordsMismatch)) && { opacity: 0.7 }
              ]}
              onPress={handleSubmit}
              disabled={isLoading || (isRegister && passwordsMismatch)}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <ThemedText style={styles.buttonText}>
                  {isRegister ? 'Registrieren und starten' : 'Einloggen'}
                </ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchButton} onPress={toggleMode} disabled={isLoading}>
              <ThemedText style={styles.switchButtonText}>
                {isRegister ? (
                  <>
                    <ThemedText style={styles.switchTextNormal}>Du hast schon ein Konto? </ThemedText>
                    <ThemedText style={styles.switchTextLink}>Zum Login</ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText style={styles.switchTextNormal}>Neu bei Toolshare? </ThemedText>
                    <ThemedText style={styles.switchTextLink}>Jetzt registrieren</ThemedText>
                  </>
                )}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginVertical: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    color: Colors.brand,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  form: {},
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.md,
  },
  passwordInput: {
    flex: 1,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  eyeButton: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputInvalid: {
    borderColor: Colors.danger,
  },
  fieldError: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  fieldSuccess: {
    color: Colors.success,
    fontSize: 12,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  button: {
    backgroundColor: Colors.brand,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 14,
    textAlign: 'center',
  },
  switchTextNormal: {
    color: Colors.textMuted,
  },
  switchTextLink: {
    color: Colors.brand,
    fontWeight: 'bold',
  },
});
