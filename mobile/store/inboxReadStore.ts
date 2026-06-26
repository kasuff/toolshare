import { create } from 'zustand';
import { api } from '@toolshare/shared';
import type { Booking, Rating } from '@toolshare/shared';
import {
  INBOX_SEED_MARKER,
  collectAllMessageKeys,
  collectIncomingMessageKeys,
  ratingMessageKey,
} from '../utils/inboxMessageRead';
import { useAuthStore } from './authStore';

// Client-State der Inbox: die als gelesen markierten Nachrichten-IDs. Quelle der
// Wahrheit ist jetzt der Server (GET/POST /inbox/read-receipts) statt SecureStore →
// geräteübergreifend konsistent. Der Read-Status ist append-only (Keys werden nur
// hinzugefügt), daher sind Vereinigungen immer korrekt. Pendant zu
// frontend/src/store/inboxStore.ts; die Persistenz ist hier asynchron, daher die
// Promise-Actions und das isStorageLoaded-Flag.
interface InboxReadState {
  readMessageIds: Set<string>;
  isStorageLoaded: boolean;
  /** Nutzer, für den bereits geladen/geseedet wurde – verhindert wiederholtes Laden bei jedem Poll. */
  loadedUserId: string | null;

  /** Lädt die Server-Receipts des Nutzers und seedet (einmalig) die Erst-Historie. */
  loadForUser: (userId: string, bookings: Booking[], ratings: Rating[]) => Promise<void>;
  /** Markiert einen Thread (eingehende Nachrichten) als gelesen und persistiert server-seitig. */
  markThreadRead: (userId: string, booking: Booking, rating?: Rating | null) => Promise<void>;
  reset: () => void;
}

export const useInboxReadStore = create<InboxReadState>((set, get) => ({
  readMessageIds: new Set(),
  isStorageLoaded: false,
  loadedUserId: null,

  loadForUser: async (userId, bookings, ratings) => {
    if (get().loadedUserId === userId && get().isStorageLoaded) {
      return;
    }
    const token = useAuthStore.getState().token;
    if (!token) return;

    let serverIds: Set<string>;
    try {
      serverIds = new Set(await api.getInboxReadReceipts(token));
    } catch {
      // Ohne Server-Stand lieber nichts seeden (sonst würde später erneut geseedet).
      return;
    }

    // Erstes Mal: alle vorhandenen Nachrichten als gelesen seeden. Der
    // __seeded__-Marker liegt server-seitig → einmalig pro Nutzer, nicht pro Gerät.
    if (!serverIds.has(INBOX_SEED_MARKER)) {
      const apiBookings = bookings.filter((booking) => booking.type !== 'SYSTEM_WARNING');
      const keys = collectAllMessageKeys(apiBookings);
      for (const rating of ratings) {
        keys.push(ratingMessageKey(rating.bookingId, rating.id));
      }
      keys.push(INBOX_SEED_MARKER);
      for (const key of keys) serverIds.add(key);
      try {
        await api.addInboxReadReceipts(keys, token);
      } catch {
        // Lokal trotzdem als geladen behandeln; nächster loadForUser versucht es erneut.
      }
    }

    set({ readMessageIds: serverIds, isStorageLoaded: true, loadedUserId: userId });
  },

  markThreadRead: async (userId, booking, rating) => {
    if (booking.type === 'SYSTEM_WARNING') return;
    const token = useAuthStore.getState().token;
    if (!token) return;

    const incomingKeys = collectIncomingMessageKeys(booking, userId);
    if (rating && rating.toUserId === userId && rating.status === 'SICHTBAR') {
      incomingKeys.push(ratingMessageKey(booking.id, rating.id));
    }

    const { readMessageIds } = get();
    const added = incomingKeys.filter((key) => !readMessageIds.has(key));
    if (added.length === 0) return;

    const next = new Set(readMessageIds);
    for (const key of added) next.add(key);
    set({ readMessageIds: next });

    try {
      await api.addInboxReadReceipts(added, token);
    } catch (error) {
      console.error('Failed to persist inbox read receipts', error);
    }
  },

  reset: () => {
    set({ readMessageIds: new Set(), isStorageLoaded: false, loadedUserId: null });
  },
}));
