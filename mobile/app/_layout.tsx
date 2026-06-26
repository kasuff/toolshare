import { Slot } from 'expo-router';
import { View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { LoadingSpinner } from '../components/EmptyState';
import { setApiBaseUrl } from '@toolshare/shared';
import { useAuth, useProtectedRoute } from '../hooks/useAuth';
import { queryClient } from '../lib/queryClient';
import { useReactQueryFocus } from '../hooks/useReactQueryFocus';
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

import { StatusBar } from 'expo-status-bar';
import { createThemedStyleSheet } from '../constants/theme';
import { usePushNotifications } from '../hooks/usePushNotifications';

function AppLayout() {
  const { isLoaded, token, currentUser } = useAuth();
  useProtectedRoute();
  useReactQueryFocus();
  usePushNotifications(token, currentUser?.id);
  const styles = useStyles();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <Slot />
      <ToastViewport />
      <StatusBar style="auto" />
    </View>
  );
}

import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppLayout />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const useStyles = createThemedStyleSheet((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
}));
