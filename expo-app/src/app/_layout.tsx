import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { SentinelleProvider } from '@/state/SentinelleProvider';

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <SentinelleProvider>
        <StatusBar style="dark" />
        <AuthGuard />
      </SentinelleProvider>
    </AuthProvider>
  );
}
