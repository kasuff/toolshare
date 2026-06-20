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
            <TextInput
              style={styles.input}
              placeholder="E-Mail *"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            {isRegister && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Name *"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                />

                <AddressInput
                  value={address}
                  onChange={setAddress}
                  label="Adresse *"
                  required
                />
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder={isRegister ? 'Passwort (mind. 8 Zeichen) *' : 'Passwort *'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isRegister ? 'new-password' : 'password'}
            />

            {isRegister && (
              <>
                <TextInput
                  style={[styles.input, passwordsMismatch && styles.inputInvalid]}
                  placeholder="Passwort wiederholen *"
                  value={repeatPassword}
                  onChangeText={setRepeatPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />

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
