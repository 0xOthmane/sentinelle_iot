import { StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '@/utils/format';
import type { Measurement } from '@/types';

export function OfflineBanner({
  visible,
  networkConnected,
  lastMeasurement,
}: {
  visible: boolean;
  networkConnected: boolean;
  lastMeasurement: Measurement | null;
}) {
  if (!visible) return null;

  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineTitle}>
        {!networkConnected ? 'Mode hors ligne' : 'Reconnexion en cours'}
      </Text>
      <Text style={styles.offlineText}>
        {lastMeasurement
          ? `Dernières données : ${formatDateTime(lastMeasurement.ts)}`
          : 'Aucune donnée locale disponible'}
      </Text>
    </View>
  );
}

export function ConnectionPill({ label, online }: { label: string; online: boolean }) {
  return (
    <View style={styles.connectionPill}>
      <View
        style={[
          styles.dot,
          online ? styles.dotOnline : styles.dotOffline,
        ]}
      />
      <Text style={styles.connectionText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#F5E5C8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5B7',
  },
  offlineTitle: {
    color: '#7E6741',
    fontWeight: '800',
    fontSize: 13,
  },
  offlineText: {
    marginTop: 2,
    color: '#8D795A',
    fontSize: 12,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0E6E1',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  dotOnline: {
    backgroundColor: '#7FB28C',
  },
  dotOffline: {
    backgroundColor: '#D9A19A',
  },
  connectionText: {
    color: '#766862',
    fontSize: 11,
    fontWeight: '700',
  },
});
