import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Card, CardHeader } from '@/components/card';
import { ScreenShell } from '@/components/screen-shell';
import { ScreenTitle } from '@/components/screen-title';
import { SegmentedControl } from '@/components/segmented-control';
import { SoftChart } from '@/components/soft-chart';
import { StatBox } from '@/components/stat-box';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { toChartPoints } from '@/utils/chart';

// Placeholder values until the backend hooks are wired up.
const THRESHOLDS = {
  tMin: 19,
  tMax: 24,
  hMin: 40,
  hMax: 60,
};

type Measurement = {
  t: number;
  h: number;
};

const MEASUREMENTS: Measurement[] = Array.from({ length: 36 }, (_, index) => ({
  t: 21.4 + Math.sin(index / 5) * 1.1 + Math.cos(index / 11) * 0.3,
  h: 48 + Math.sin(index / 7 + 1) * 6 + Math.cos(index / 3) * 1.5,
}));

const TEMPERATURE_POINTS = toChartPoints(MEASUREMENTS, 't');
const HUMIDITY_POINTS = toChartPoints(MEASUREMENTS, 'h');

const RANGES = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 jours' },
] as const;

type HistoryRange = (typeof RANGES)[number]['value'];

function summarize(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  return { min, avg, max };
}

const TEMPERATURE_STATS = summarize(MEASUREMENTS.map((measurement) => measurement.t));
const HUMIDITY_STATS = summarize(MEASUREMENTS.map((measurement) => measurement.h));

export default function HistoryScreen() {
  const [range, setRange] = useState<HistoryRange>('24h');

  return (
    <ScreenShell title="Sentinelle" statusLabel="Connecté" online>
      <ScreenTitle
        eyebrow="HISTORIQUE"
        title="Évolution de la chambre"
        subtitle="Température et humidité enregistrées."
      />

      <SegmentedControl options={RANGES} value={range} onChange={setRange} />

      <Card>
        <CardHeader eyebrow="Mesures" title="Température" />
        <SoftChart
          data={TEMPERATURE_POINTS}
          unit="°C"
          minThreshold={THRESHOLDS.tMin}
          maxThreshold={THRESHOLDS.tMax}
        />
      </Card>

      <Card>
        <CardHeader eyebrow="Mesures" title="Humidité" />
        <SoftChart
          data={HUMIDITY_POINTS}
          unit="%"
          minThreshold={THRESHOLDS.hMin}
          maxThreshold={THRESHOLDS.hMax}
        />
      </Card>

      <Card>
        <CardHeader eyebrow="Statistiques" title="Résumé" />

        <ThemedText type="small" themeColor="textSecondary" style={styles.statHeader}>
          Température
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.statsRow}>
          <StatBox label="Min" value={`${TEMPERATURE_STATS.min.toFixed(1)}°`} />
          <StatBox label="Moy." value={`${TEMPERATURE_STATS.avg.toFixed(1)}°`} />
          <StatBox label="Max" value={`${TEMPERATURE_STATS.max.toFixed(1)}°`} />
        </ThemedView>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={[styles.statHeader, styles.statHeaderSpaced]}>
          Humidité
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.statsRow}>
          <StatBox label="Min" value={`${HUMIDITY_STATS.min.toFixed(1)}%`} />
          <StatBox label="Moy." value={`${HUMIDITY_STATS.avg.toFixed(1)}%`} />
          <StatBox label="Max" value={`${HUMIDITY_STATS.max.toFixed(1)}%`} />
        </ThemedView>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statHeader: {
    marginBottom: 9,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statHeaderSpaced: {
    marginTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
  },
});
