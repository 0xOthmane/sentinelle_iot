import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Card, CardHeader } from '@/components/card';
import { LedCard } from '@/components/led-card';
import { MetricCard } from '@/components/metric-card';
import { ScreenShell } from '@/components/screen-shell';
import { SoftChart, type ChartPoint } from '@/components/soft-chart';
import { StateCard } from '@/components/state-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThresholdSummary } from '@/components/threshold-summary';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';

// Placeholder values until the backend hooks are wired up.
const THRESHOLDS = {
  tMin: 19,
  tMax: 24,
  hMin: 40,
  hMax: 60,
  holdSeconds: 30,
};

const TEMPERATURE = 21.4;
const HUMIDITY = 48;

const SAMPLE_MEASUREMENTS: ChartPoint[] = Array.from({ length: 24 }, (_, index) => ({
  x: index,
  y: 21.4 + Math.sin(index / 3) * 0.7 + (index % 3) * 0.08,
}));

export default function HomeScreen() {
  const colors = useSentinelColors();
  const [ledOn, setLedOn] = useState(false);

  return (
    <ScreenShell
      title="Sentinelle"
      subtitle="La chambre, tout doucement."
      statusLabel="Connecté"
      online>
      <StateCard
        kind="good"
        title="Tout va bien"
        text="La chambre est calme et confortable."
      />

      <ThemedView style={styles.metricRow}>
        <MetricCard
          emoji="🌡️"
          label="Température"
          value={TEMPERATURE}
          unit="°C"
          min={THRESHOLDS.tMin}
          max={THRESHOLDS.tMax}
        />
        <MetricCard
          emoji="💧"
          label="Humidité"
          value={HUMIDITY}
          unit="%"
          min={THRESHOLDS.hMin}
          max={THRESHOLDS.hMax}
        />
      </ThemedView>

      <Card>
        <CardHeader
          eyebrow="Seuils de confort"
          title="Surveillance"
          right={
            <Pressable
              style={[
                styles.smallButton,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
              onPress={() => router.push('/settings')}>
              <ThemedText
                type="small"
                style={[styles.smallButtonText, { color: colors.accentText }]}>
                Modifier
              </ThemedText>
            </Pressable>
          }
        />

        <ThemedView type="backgroundElement" style={styles.summaryRow}>
          <ThresholdSummary
            label="Température"
            value={`${THRESHOLDS.tMin} – ${THRESHOLDS.tMax} °C`}
          />
          <ThresholdSummary
            label="Humidité"
            value={`${THRESHOLDS.hMin} – ${THRESHOLDS.hMax} %`}
          />
        </ThemedView>

        <ThemedView
          style={[
            styles.holdBox,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}>
          <Text style={styles.holdEmoji}>⏱️</Text>
          <ThemedView style={[styles.holdTextWrap, styles.transparent]}>
            <ThemedText type="smallBold" style={styles.holdTitle}>
              Délai avant alerte
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.holdText}>
              Une valeur doit rester hors seuil pendant{' '}
              <ThemedText type="smallBold" style={{ color: colors.accentText }}>
                {THRESHOLDS.holdSeconds} seconde
                {THRESHOLDS.holdSeconds > 1 ? 's' : ''}
              </ThemedText>{' '}
              avant le déclenchement.
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Card>

      <LedCard
        ledOn={ledOn}
        ledPending={false}
        networkConnected
        onToggle={setLedOn}
      />

      <Card>
        <CardHeader
          eyebrow="Aperçu"
          title="10 dernières minutes"
          right={
            <ThemedView type="backgroundElement" style={styles.liveRow}>
              <ThemedView style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <ThemedText type="small" style={[styles.liveText, { color: colors.success }]}>
                LIVE
              </ThemedText>
            </ThemedView>
          }
        />

        <SoftChart
          data={SAMPLE_MEASUREMENTS}
          unit="°C"
          minThreshold={THRESHOLDS.tMin}
          maxThreshold={THRESHOLDS.tMax}
        />

        <Pressable
          style={[
            styles.softButton,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
          onPress={() => router.push('/history')}>
          <ThemedText
            type="smallBold"
            style={[styles.softButtonText, { color: colors.accentText }]}>
            Voir tout l’historique
          </ThemedText>
        </Pressable>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  smallButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: Spacing.two,
  },
  smallButtonText: {
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
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: 14,
  },
  holdEmoji: {
    fontSize: 21,
    marginRight: 11,
  },
  holdTextWrap: {
    flex: 1,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  holdTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  holdText: {
    marginTop: Spacing.one,
    fontSize: 12,
    lineHeight: 18,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  softButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: 13,
    marginTop: Spacing.two,
  },
  softButtonText: {
    textAlign: 'center',
    fontWeight: '800',
  },
});
