import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { SentinelleProvider } from '@/state/SentinelleProvider';
import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@/constants/config';

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

function AuthGuard() {
  const { token, isReady } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!isReady) return;
    const inLogin = segments[0] === 'login';
    if (!token && !inLogin) {
      router.replace('/login');
    } else if (token && inLogin) {
      router.replace('/(tabs)');
    }
  }, [token, isReady, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

function RootLayout() {
  return (
    <AuthProvider>
      <SentinelleProvider>
        <StatusBar style="dark" />
        <AuthGuard />
      </SentinelleProvider>
    </AuthProvider>
  );
}
export default Sentry.wrap(RootLayout);