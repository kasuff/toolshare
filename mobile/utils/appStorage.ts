import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;

function assertValidKey(key: string): void {
  if (!key || !SECURE_STORE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    try {
      assertValidKey(key);
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    try {
      assertValidKey(key);
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Ignore persistence errors; unread state falls back to in-memory updates.
    }
  },
};

export { storage };
