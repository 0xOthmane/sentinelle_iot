import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';
import { API_URL } from '@/constants/config';
import { registerPushToken, unregisterPushToken } from '@/api/client';
import { saveNotificationsEnabled } from '@/db/settingsStore';
import {
  BACKGROUND_NOTIFICATION_TASK,
} from '@/utils/backgroundNotifications';
import { getNotifications } from '@/utils/notifications';

export function useNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // Read from WS callbacks, which would otherwise see a stale value.
  const enabledRef = useRef(false);
  const pushTokenRef = useRef<string | null>(null);

  const registerDevice = useCallback(async () => {
    const Notifications = getNotifications();
    if (!Notifications) return false;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      throw new Error('Expo project ID is missing');
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alertes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK))) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    }
    await registerPushToken(
      API_URL,
      token,
      Platform.OS === 'ios' ? 'ios' : 'android',
    );
    pushTokenRef.current = token;
    return true;
  }, []);

  useEffect(() => {
    enabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  const hydrateNotifications = useCallback(
    (stored: boolean) => {
      const available = stored && getNotifications() !== null;
      setNotificationsEnabled(available);
      if (available) {
        void registerDevice().catch((error) =>
          console.warn('[NOTIFICATIONS] Push token registration failed', error),
        );
      }
    },
    [registerDevice],
  );

  const notifyLocal = useCallback(async (title: string, body: string) => {
    if (!enabledRef.current || pushTokenRef.current) return;
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  }, []);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      const token = pushTokenRef.current;
      if (token) {
        await unregisterPushToken(API_URL, token).catch((error) =>
          console.warn('[NOTIFICATIONS] Push token removal failed', error),
        );
        pushTokenRef.current = null;
      }
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      return;
    }

    const Notifications = getNotifications();
    if (!Notifications) {
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      Alert.alert(
        'Notifications indisponibles',
        'Mettez à jour Expo Go ou installez une nouvelle version de développement compatible. Les alertes restent visibles dans l’app et dans le Journal.',
      );
      return;
    }

    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      Alert.alert(
        'Notifications refusées',
        'Les alertes resteront visibles dans l’app et dans le Journal.',
      );
      return;
    }

    try {
      await registerDevice();
    } catch (error) {
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      const rawDetail = error instanceof Error ? error.message : String(error);
      const detail = rawDetail.includes('Firebase Messaging')
        ? `${rawDetail} Vérifiez la configuration Firebase Android (google-services.json et FCM V1 dans EAS).`
        : rawDetail;
      console.warn('[NOTIFICATIONS] Push token registration failed', error);
      Alert.alert(
        'Notifications indisponibles',
        `Échec de l’enregistrement : ${detail}`,
      );
      return;
    }

    setNotificationsEnabled(true);
    await saveNotificationsEnabled(true);
  }, [registerDevice]);

  return {
    notificationsEnabled,
    hydrateNotifications,
    notifyLocal,
    toggleNotifications,
  };
}
