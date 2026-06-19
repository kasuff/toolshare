import { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { api } from '@toolshare/shared';
import { useAuth } from '../../hooks/useAuth';
import { ThemedText } from '../../components/ThemedText';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { useToast } from '../../hooks/useToast';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { pushToast } = useToast();

  const handleLogin = async () => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      const { accessToken } = await api.login(email, password);
      await login(accessToken);
      router.replace('/tools');
    } catch (err: any) {
      pushToast(err.message || 'Login fehlgeschlagen', 'error');
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ThemedText type="title" style={styles.title}>ToolShare</ThemedText>
        <ThemedText type="muted" style={styles.subtitle}>Bitte melde dich an</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.button, isLoading && { opacity: 0.7 }]} onPress={handleLogin} disabled={isLoading}>
          <ThemedText style={styles.buttonText}>{isLoading ? 'Lädt...' : 'Einloggen'}</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.bg,
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
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.brand,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: {
    color: Colors.surface,
    fontWeight: 'bold',
    fontSize: 16,
  }
});
