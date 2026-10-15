import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SentinelleProvider } from '@/state/SentinelleProvider';

export default function RootLayout() {
  return (
    <SentinelleProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SentinelleProvider>
  );
}
