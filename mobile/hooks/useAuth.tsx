import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';

// Kompatibilitäts-Hook: liefert dieselbe Form wie der frühere AuthProvider-Context,
// liest den Zustand aber aus dem Zustand-Store (store/authStore). So bleiben alle
// Screens (const { token, currentUser, ... } = useAuth()) unverändert.
export function useAuth() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const token = useAuthStore((s) => s.token);
  const isLoaded = useAuthStore((s) => s.isLoaded);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  return { currentUser, token, isLoaded, login, logout, updateProfile };
}

// Routing-Guard: lädt die Session einmalig und leitet je nach Token-Status zwischen
// dem (auth)-Bereich und der App um. Ersetzt den früheren Navigations-Effekt im
// AuthProvider; reagiert auch auf Token-Ablauf (onSessionExpired setzt token=null).
export function useProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const isLoaded = useAuthStore((s) => s.isLoaded);
  const initSession = useAuthStore((s) => s.initSession);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void initSession();
  }, [initSession]);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/tools');
    }
  }, [token, isLoaded, segments, router]);
}
