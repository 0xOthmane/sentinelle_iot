import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { useHistory, useThresholds } from '@/api';
import { Card, CardHeader } from '@/components/card';
import { ScreenShell } from '@/components/screen-shell';
import { ScreenTitle } from '@/components/screen-title';
import { SegmentedControl } from '@/components/segmented-control';
import { SoftChart } from '@/components/soft-chart';
import { StatBox } from '@/components/stat-box';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME, DEFAULT_THRESHOLDS, DEVICE_ID } from '@/constants/config';
import { useLiveStore } from '@/stores/live-store';
import type { HistoryRange } from '@/types';
import { formatHistoryTime, toChartPoints } from '@/utils/chart';
import { connectionLabel, isLiveConnected } from '@/utils/room-state';
import { computeHistoryStats } from '@/utils/stats';

const RANGES = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 jours' },
] as const;

export default function HistoryScreen() {
  const [range, setRange] = useState<HistoryRange>('24h');

  const thresholdsQuery = useThresholds(DEVICE_ID);
  const thresholds = thresholdsQuery.data?.value ?? DEFAULT_THRESHOLDS;
  const historyQuery = useHistory({ range });
  const measurements = useMemo(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );

  const connection = useLiveStore((state) => state.connection);
  const deviceStatus = useLiveStore((state) => state.deviceStatus);
  const online = isLiveConnected(connection, deviceStatus);
  const statusLabel = connectionLabel(connection, deviceStatus);

  const temperaturePoints = useMemo(
    () => toChartPoints(measurements, 't', 'ts'),
    [measurements],
  );
  const humidityPoints = useMemo(
    () => toChartPoints(measurements, 'h', 'ts'),
    [measurements],
  );
  const stats = useMemo(() => computeHistoryStats(measurements), [measurements]);

  const xDomain = useMemo(() => {
    const first = measurements[0];
    const last = measurements[measurements.length - 1];
    return first && last && last.ts > first.ts
      ? ([first.ts, last.ts] as const)
      : undefined;
  }, [measurements]);

  return (
    <ScreenShell title={APP_NAME} statusLabel={statusLabel} online={online}>
      <ScreenTitle
        eyebrow="HISTORIQUE"
        title="Évolution de la chambre"
        subtitle="Température et humidité enregistrées."
      />

      <SegmentedControl options={RANGES} value={range} onChange={setRange} />

      {historyQuery.isPending && measurements.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.loading}>
          Chargement de l’historique…
        </ThemedText>
      ) : null}

      <Card>
        <CardHeader eyebrow="Mesures" title="Température" />
        <SoftChart
          data={temperaturePoints}
          unit="°C"
          minThreshold={thresholds.tMin}
          maxThreshold={thresholds.tMax}
          xDomain={xDomain}
          formatX={(ts) => formatHistoryTime(range, ts)}
        />
      </Card>

      <Card>
        <CardHeader eyebrow="Mesures" title="Humidité" />
        <SoftChart
          data={humidityPoints}
          unit="%"
          minThreshold={thresholds.hMin}
          maxThreshold={thresholds.hMax}
          xDomain={xDomain}
          formatX={(ts) => formatHistoryTime(range, ts)}
        />
      </Card>

      <Card>
        <CardHeader eyebrow="Statistiques" title="Résumé" />

        <ThemedText type="small" themeColor="textSecondary" style={styles.statHeader}>
          Température
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.statsRow}>
          <StatBox
            label="Min"
            value={stats ? `${stats.tMin.toFixed(1)}°` : '—'}
          />
          <StatBox
            label="Moy."
            value={stats ? `${stats.tAvg.toFixed(1)}°` : '—'}
          />
          <StatBox
            label="Max"
            value={stats ? `${stats.tMax.toFixed(1)}°` : '—'}
          />
        </ThemedView>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={[styles.statHeader, styles.statHeaderSpaced]}>
          Humidité
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.statsRow}>
          <StatBox
            label="Min"
            value={stats ? `${stats.hMin.toFixed(1)}%` : '—'}
          />
          <StatBox
            label="Moy."
            value={stats ? `${stats.hAvg.toFixed(1)}%` : '—'}
          />
          <StatBox
            label="Max"
            value={stats ? `${stats.hMax.toFixed(1)}%` : '—'}
          />
        </ThemedView>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
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
