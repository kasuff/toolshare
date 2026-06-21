import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "@toolshare/shared";
import { storage } from "../utils/appStorage";

const PUSH_LISTENER_DEBOUNCE_MS = 3_000;
const MIN_SYNC_INTERVAL_MS = 30_000;

function syncedPushTokenKey(userId: string) {
  return `toolshare.synced_push.${userId}`;
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  console.warn("Push notifications are not supported in this environment:", error);
}

export function usePushNotifications(token: string | null, userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState("");
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );
  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const lastSyncAttemptAtRef = useRef(0);
  const listenerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || !userId) {
      lastSyncedTokenRef.current = null;
      return;
    }

    let cancelled = false;
    const storageKey = syncedPushTokenKey(userId);

    void storage.getItem(storageKey).then((stored) => {
      if (!cancelled && stored) {
        lastSyncedTokenRef.current = stored;
        setExpoPushToken(stored);
      }
    });

    const syncPushToken = async (pushToken: string) => {
      if (pushToken === lastSyncedTokenRef.current) {
        setExpoPushToken(pushToken);
        return;
      }

      const now = Date.now();
      if (
        syncInFlightRef.current ||
        (now - lastSyncAttemptAtRef.current < MIN_SYNC_INTERVAL_MS &&
          lastSyncAttemptAtRef.current > 0)
      ) {
        return;
      }

      syncInFlightRef.current = true;
      lastSyncAttemptAtRef.current = now;
      setExpoPushToken(pushToken);

      try {
        await api.updateMyProfile({ expoPushToken: pushToken }, token);
        lastSyncedTokenRef.current = pushToken;
        await storage.setItem(storageKey, pushToken);
      } catch (error) {
        console.error("Failed to sync push token", error);
      } finally {
        syncInFlightRef.current = false;
      }
    };

    const refreshExpoPushToken = () => {
      registerForPushNotificationsAsync().then((pushToken) => {
        if (pushToken) {
          void syncPushToken(pushToken);
        }
      });
    };

    refreshExpoPushToken();

    const pushTokenListener = Notifications.addPushTokenListener(() => {
      if (listenerDebounceRef.current) {
        clearTimeout(listenerDebounceRef.current);
      }
      listenerDebounceRef.current = setTimeout(() => {
        refreshExpoPushToken();
      }, PUSH_LISTENER_DEBOUNCE_MS);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (nextNotification) => {
        setNotification(nextNotification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification tapped", response);
      }
    );

    return () => {
      cancelled = true;
      if (listenerDebounceRef.current) {
        clearTimeout(listenerDebounceRef.current);
      }
      pushTokenListener.remove();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [token, userId]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("Failed to get push token for push notification!");
      return null;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn("Missing EAS projectId – push token registration will fail.");
      return null;
    }

    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log("Expo Push Token:", token);
    } catch (e) {
      console.warn("Could not get Expo Push Token", e);
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}
