import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_NAME, useSentinelle } from '@/state/SentinelleProvider';
import { ConnectionPill, OfflineBanner } from '@/components/Connection';
import { connectionLabel } from '@/utils/format';

export function ScreenShell({ children }: { children: ReactNode }) {
  const {
    backendOnline,
    deviceStatus,
    networkConnected,
    lastMeasurement,
  } = useSentinelle();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.shell}>
        <OfflineBanner
          visible={!backendOnline}
          networkConnected={networkConnected}
          lastMeasurement={lastMeasurement}
        />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.appName}>{APP_NAME}</Text>
              <Text style={styles.subtitle}>La chambre, tout doucement.</Text>
            </View>
            <ConnectionPill
              label={connectionLabel(
                networkConnected,
                backendOnline,
                deviceStatus,
              )}
              online={backendOnline && deviceStatus === 'online'}
            />
          </View>

          {children}

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF9F6',
  },
  shell: {
    flex: 1,
    backgroundColor: '#FFF9F6',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#5F514B',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 2,
    color: '#9B8D86',
    fontSize: 13,
  },
});
