import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

// Verbindet React Querys focusManager mit dem AppState von React Native. Damit
// greift refetchOnWindowFocus auch nativ: kehrt die App in den Vordergrund zurück,
// werden veraltete Queries (z. B. die Inbox) neu geladen. Auf Web übernimmt React
// Query das Fokus-Handling selbst.
export function useReactQueryFocus() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });

    return () => subscription.remove();
  }, []);
}
