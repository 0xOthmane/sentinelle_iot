import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type Notifications = typeof import('expo-notifications');
let notifications: Notifications | undefined;

export function getNotifications(): Notifications | null {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  // Check the push-token native module specifically. The topic-subscription
  // module is optional and is unrelated to notification availability.
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) {
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
