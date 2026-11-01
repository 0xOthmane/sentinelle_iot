import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { saveNotificationsEnabled } from '@/db/settingsStore';
import { getNotifications } from '@/utils/notifications';

export function useNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // Read from WS callbacks, which would otherwise see a stale value.
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  const hydrateNotifications = useCallback((stored: boolean) => {
    setNotificationsEnabled(stored && getNotifications() !== null);
  }, []);

  const notifyLocal = useCallback(async (title: string, body: string) => {
    if (!enabledRef.current) return;
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  }, []);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!enabled) {
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

    setNotificationsEnabled(true);
    await saveNotificationsEnabled(true);
  }, []);

  return {
    notificationsEnabled,
    hydrateNotifications,
    notifyLocal,
    toggleNotifications,
  };
}
