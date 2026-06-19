import { Slot } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { LoadingSpinner } from '../components/EmptyState';
import { setApiBaseUrl } from '@toolshare/shared';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import { ToastViewport } from '../components/Toast';

import Constants from 'expo-constants';
import { Platform } from 'react-native';

function parseHostFromUri(uri?: string | null) {
  if (!uri) return null;
  return uri.split(':')[0] || null;
}

// Dynamically determine backend API URL for Expo Go, Dev Client, simulators and devices
function getApiUrl() {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl;
  }

  const hostFromExpoConfig = parseHostFromUri(Constants.expoConfig?.hostUri);
  const hostFromExpoGoConfig = parseHostFromUri(Constants.expoGoConfig?.debuggerHost);

  if (hostFromExpoConfig) {
    return `http://${hostFromExpoConfig}:4000/api`;
  }

  if (hostFromExpoGoConfig) {
    return `http://${hostFromExpoGoConfig}:4000/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api';
  }

  return 'http://localhost:4000/api';
}

setApiBaseUrl(getApiUrl());

function AppLayout() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <Slot />
      <ToastViewport />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppLayout />
      </ToastProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});
