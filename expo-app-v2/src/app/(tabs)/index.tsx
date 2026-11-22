import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useThresholds } from '@/api';
import { Card, CardHeader } from '@/components/card';
import { LedCard } from '@/components/led-card';
import { MetricCard } from '@/components/metric-card';
import { ScreenShell } from '@/components/screen-shell';
import { SoftChart } from '@/components/soft-chart';
import { StateCard } from '@/components/state-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThresholdSummary } from '@/components/threshold-summary';
import { APP_NAME, DEFAULT_THRESHOLDS, DEVICE_ID } from '@/constants/config';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { acknowledgeAlert, requestManualLed } from '@/live/led-controller';
import { LIVE_WINDOW_SECONDS, useLiveStore } from '@/stores/live-store';
import { formatClockTime, toChartPoints } from '@/utils/chart';
import {
  connectionLabel,
  deriveRoomState,
  isLiveConnected,
} from '@/utils/room-state';

export default function HomeScreen() {
  const colors = useSentinelColors();

  const connection = useLiveStore((state) => state.connection);
  const deviceStatus = useLiveStore((state) => state.deviceStatus);
  const temperature = useLiveStore((state) => state.temperature);
  const humidity = useLiveStore((state) => state.humidity);
  const measurements = useLiveStore((state) => state.measurements);
  const activeAlerts = useLiveStore((state) => state.activeAlerts);
  const acknowledgedAlerts = useLiveStore((state) => state.acknowledgedAlerts);
  const ledOn = useLiveStore((state) => state.ledOn);
  const ledPending = useLiveStore((state) => state.ledPending);

  const thresholdsQuery = useThresholds(DEVICE_ID);
  const thresholds = thresholdsQuery.data?.value ?? DEFAULT_THRESHOLDS;
  const configured = thresholdsQuery.data?.configured ?? false;

  const chart = useMemo(() => {
    const latest = measurements[measurements.length - 1];

    return {
      points: toChartPoints(measurements, 't', 'ts'),
      xDomain: latest
        ? ([latest.ts - LIVE_WINDOW_SECONDS, latest.ts] as const)
        : undefined,
    };
  }, [measurements]);

  const roomState = deriveRoomState({
    alerts: activeAlerts,
    acknowledgedAlerts,
    temperature,
    humidity,
    thresholds,
    configured,
    thresholdsReady: !thresholdsQuery.isPending,
  });

  const statusLabel = connectionLabel(connection, deviceStatus);
  const online = isLiveConnected(connection, deviceStatus);

  return (
    <ScreenShell
      title={APP_NAME}
      subtitle="Surveillance en direct de la chambre"
      statusLabel={statusLabel}
      online={online}>
      <StateCard
        kind={roomState.kind}
        title={roomState.title}
        text={roomState.text}
        onAcknowledge={() => acknowledgeAlert()}
      />

      <ThemedView style={styles.metricRow}>
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
      </ThemedView>

      <Card>
        <CardHeader
          eyebrow="Aperçu"
          title="10 dernières minutes"
          right={
            <ThemedView type="backgroundElement" style={styles.liveRow}>
              <ThemedView
                style={[
                  styles.liveDot,
                  { backgroundColor: online ? colors.success : colors.muted },
                ]}
              />
              <ThemedText
                type="small"
                style={[
                  styles.liveText,
                  { color: online ? colors.success : colors.muted },
                ]}>
                {online ? 'LIVE' : 'HORS LIGNE'}
              </ThemedText>
            </ThemedView>
          }
        />

        <SoftChart
          data={chart.points}
          unit="°C"
          minThreshold={thresholds.tMin}
          maxThreshold={thresholds.tMax}
          xDomain={chart.xDomain}
          formatX={formatClockTime}
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
            value={`${thresholds.tMin} – ${thresholds.tMax} °C`}
          />
          <ThresholdSummary
            label="Humidité"
            value={`${thresholds.hMin ?? '—'} – ${thresholds.hMax ?? '—'} %`}
          />
        </ThemedView>

        {!configured && !thresholdsQuery.isPending ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.thresholdNote}>
            Seuils par défaut — enregistre-les dans les réglages pour activer les
            alertes.
          </ThemedText>
        ) : null}

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
                {thresholds.holdSeconds} seconde
                {thresholds.holdSeconds > 1 ? 's' : ''}
              </ThemedText>{' '}
              avant le déclenchement.
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Card>

      <LedCard
        ledOn={ledOn}
        ledPending={ledPending}
        networkConnected={connection === 'open'}
        onToggle={(value) => void requestManualLed(value)}
      />
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
  thresholdNote: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
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
