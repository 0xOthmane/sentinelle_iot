import { router } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LedCard } from '@/components/LedCard';
import { MetricCard } from '@/components/MetricCard';
import { ScreenShell } from '@/components/ScreenShell';
import { SoftChart } from '@/components/SoftChart';
import { StateCard } from '@/components/StateCard';
import { ThresholdSummary } from '@/components/common';
import { usePulse } from '@/hooks/usePulse';
import { useRoomState } from '@/hooks/useRoomState';
import { useSentinelle } from '@/state/SentinelleProvider';

export default function HomeScreen() {
  const {
    temperature,
    humidity,
    liveMeasurements,
    thresholds,
    activeAlert,
    backendOnline,
    networkConnected,
    ledOn,
    ledPending,
    liveLoading,
    toggleLed,
  } = useSentinelle();

  const roomState = useRoomState(
    activeAlert,
    temperature,
    humidity,
    thresholds,
  );
  const pulse = usePulse(activeAlert != null);

  return (
    <ScreenShell>
      <Animated.View style={{ transform: [{ scale: activeAlert ? pulse : 1 }] }}>
        <StateCard state={roomState} />
      </Animated.View>

      <View style={styles.metricRow}>
        <MetricCard
          emoji="🌡️"
          label="Température"
          value={temperature}
          unit="°C"
          min={thresholds.tMin}
          max={thresholds.tMax}
        />
        <MetricCard
          emoji="💧"
          label="Humidité"
          value={humidity}
          unit="%"
          min={thresholds.hMin}
          max={thresholds.hMax}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>SEUILS DE CONFORT</Text>
            <Text style={styles.cardTitle}>Surveillance</Text>
          </View>
          <Pressable
            style={styles.smallButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.smallButtonText}>Modifier</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <ThresholdSummary
            label="Température"
            value={`${thresholds.tMin} – ${thresholds.tMax} °C`}
          />
          <ThresholdSummary
            label="Humidité"
            value={`${thresholds.hMin ?? '—'} – ${thresholds.hMax ?? '—'} %`}
          />
        </View>

        <View style={styles.holdBox}>
          <Text style={styles.holdEmoji}>⏱️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.holdTitle}>Délai avant alerte</Text>
            <Text style={styles.holdText}>
              Une valeur doit rester hors seuil pendant{' '}
              <Text style={styles.bold}>
                {thresholds.holdMinutes} minute
                {thresholds.holdMinutes > 1 ? 's' : ''}
              </Text>{' '}
              avant le déclenchement.
            </Text>
          </View>
        </View>
      </View>

      <LedCard
        ledOn={ledOn}
        ledPending={ledPending}
        networkConnected={networkConnected}
        onToggle={() => void toggleLed()}
      />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>APERÇU</Text>
            <Text style={styles.cardTitle}>10 dernières minutes</Text>
          </View>
          <Text style={styles.liveText}>
            {backendOnline ? '● LIVE' : '● CACHE'}
          </Text>
        </View>

        {liveLoading ? (
          <ActivityIndicator style={{ marginVertical: 32 }} />
        ) : (
          <SoftChart
            data={liveMeasurements}
            valueKey="t"
            unit="°C"
            minThreshold={thresholds.tMin}
            maxThreshold={thresholds.tMax}
          />
        )}

        <Pressable
          style={styles.softButton}
          onPress={() => router.push('/history')}
        >
          <Text style={styles.softButtonText}>Voir tout l’historique</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E7E2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#B28E83',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: '#5E524C',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 3,
  },
  smallButton: {
    backgroundColor: '#FAEDEA',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#A66F63',
    fontWeight: '800',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  holdBox: {
    flexDirection: 'row',
    marginTop: 13,
    backgroundColor: '#F8F3EA',
    borderRadius: 17,
    padding: 14,
  },
  holdEmoji: {
    fontSize: 21,
    marginRight: 11,
  },
  holdTitle: {
    color: '#6B5E55',
    fontWeight: '800',
    fontSize: 13,
  },
  holdText: {
    marginTop: 4,
    color: '#8A7D75',
    lineHeight: 18,
    fontSize: 12,
  },
  bold: {
    fontWeight: '800',
    color: '#6A5A52',
  },
  liveText: {
    color: '#6C9D78',
    fontWeight: '800',
    fontSize: 11,
  },
  softButton: {
    backgroundColor: '#FAEFEC',
    borderRadius: 17,
    paddingVertical: 13,
    marginTop: 7,
  },
  softButtonText: {
    textAlign: 'center',
    color: '#9B6A60',
    fontWeight: '800',
  },
});
