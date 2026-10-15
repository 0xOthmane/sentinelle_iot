import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type Notifications = typeof import('expo-notifications');
let notifications: Notifications | undefined;

export function getNotifications(): Notifications | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  // SDK 57's notifications entry point eagerly loads this Android module,
  // which may be absent from Expo Go or a development build made before upgrading.
  if (
    Platform.OS === 'android' &&
    !requireOptionalNativeModule('ExpoTopicSubscriptionModule')
  ) {
    return null;
  }

  if (!notifications) {
    // Load only after checking native compatibility so routes can still render.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notifications = require('expo-notifications') as Notifications;
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return notifications;
}
