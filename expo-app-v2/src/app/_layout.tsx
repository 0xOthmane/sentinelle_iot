import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { SENTRY_DSN } from '@/constants/config';
import { ApiProvider } from '@/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: SENTRY_DSN,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});


function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ApiProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppTabs />
      </ThemeProvider>
    </ApiProvider>
  );
}

export default Sentry.wrap(TabLayout);
