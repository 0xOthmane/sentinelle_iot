import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { SoftChart } from '@/components/SoftChart';
import { ScreenTitle, StatBox } from '@/components/common';
import { useSentinelle } from '@/state/SentinelleProvider';
import type { HistoryRange } from '@/types';

const RANGES: HistoryRange[] = ['1h', '24h', '7d'];

export default function HistoryScreen() {
  const {
    historyMeasurements,
    historyStats,
    historyRange,
    setHistoryRange,
    historyLoading,
    thresholds,
  } = useSentinelle();

  return (
    <ScreenShell>
      <ScreenTitle
        eyebrow="HISTORIQUE"
        title="Évolution de la chambre"
        subtitle="Température et humidité enregistrées."
      />

      <View style={styles.segmented}>
        {RANGES.map((item) => (
          <Pressable
            key={item}
            style={[
              styles.segment,
              historyRange === item && styles.segmentActive,
            ]}
            onPress={() => setHistoryRange(item)}
          >
            <Text
              style={[
                styles.segmentText,
                historyRange === item && styles.segmentTextActive,
              ]}
            >
              {item === '7d' ? '7 jours' : item}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Température</Text>
        {historyLoading ? (
          <ActivityIndicator style={{ marginVertical: 32 }} />
        ) : (
          <SoftChart
            data={historyMeasurements}
            valueKey="t"
            unit="°C"
            minThreshold={thresholds.tMin}
            maxThreshold={thresholds.tMax}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Humidité</Text>
        <SoftChart
          data={historyMeasurements}
          valueKey="h"
          unit="%"
          minThreshold={thresholds.hMin}
          maxThreshold={thresholds.hMax}
        />
      </View>

      {historyStats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Résumé</Text>

          <Text style={styles.statHeader}>Température</Text>
          <View style={styles.statsRow}>
            <StatBox label="Min" value={`${historyStats.tMin.toFixed(1)}°`} />
            <StatBox label="Moy." value={`${historyStats.tAvg.toFixed(1)}°`} />
            <StatBox label="Max" value={`${historyStats.tMax.toFixed(1)}°`} />
          </View>

          <Text style={[styles.statHeader, { marginTop: 20 }]}>Humidité</Text>
          <View style={styles.statsRow}>
            <StatBox label="Min" value={`${historyStats.hMin.toFixed(1)}%`} />
            <StatBox label="Moy." value={`${historyStats.hAvg.toFixed(1)}%`} />
            <StatBox label="Max" value={`${historyStats.hMax.toFixed(1)}%`} />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E7E2',
  },
  cardTitle: {
    color: '#5E524C',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 3,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F4ECE8',
    padding: 4,
    borderRadius: 18,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#95857D',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#7B5F56',
  },
  statHeader: {
    marginTop: 15,
    marginBottom: 9,
    color: '#9B8C84',
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
  },
});
