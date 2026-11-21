import {
  Canvas,
  DashPathEffect,
  Line,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';

export type ChartPoint = {
  /** Timestamp in milliseconds, or a sequential index. */
  x: number;
  /** Measured value. */
  y: number;
};

const PADDING_X = 14;
const PADDING_Y = 26;
const DEFAULT_HEIGHT = 190;

export function SoftChart({
  data,
  unit,
  minThreshold,
  maxThreshold,
  height = DEFAULT_HEIGHT,
}: {
  data: ChartPoint[];
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
  height?: number;
}) {
  const colors = useSentinelColors();
  const [width, setWidth] = useState(0);

  const chart = useMemo(() => {
    if (width <= 0 || data.length < 2) {
      return null;
    }

    const values = data.map((point) => point.y);
    const thresholdValues = [minThreshold, maxThreshold].filter(
      (value): value is number => value != null,
    );
    const minBase = Math.min(...values, ...thresholdValues);
    const maxBase = Math.max(...values, ...thresholdValues);
    const padding = Math.max((maxBase - minBase) * 0.15, 0.5);
    const min = minBase - padding;
    const max = maxBase + padding;
    const range = max - min || 1;
    const plotWidth = Math.max(width - PADDING_X * 2, 1);
    const plotHeight = height - PADDING_Y * 2;
    const baseline = height - PADDING_Y;

    const xFor = (index: number) =>
      PADDING_X + (index / Math.max(data.length - 1, 1)) * plotWidth;
    const yFor = (value: number) => baseline - ((value - min) / range) * plotHeight;

    const lineBuilder = Skia.PathBuilder.Make();
    const areaBuilder = Skia.PathBuilder.Make();

    data.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.y);
      if (index === 0) {
        lineBuilder.moveTo(x, y);
        areaBuilder.moveTo(x, baseline);
        areaBuilder.lineTo(x, y);
      } else {
        lineBuilder.lineTo(x, y);
        areaBuilder.lineTo(x, y);
      }
    });

    areaBuilder.lineTo(xFor(data.length - 1), baseline);
    areaBuilder.close();

    return {
      linePath: lineBuilder.build(),
      areaPath: areaBuilder.build(),
      min,
      max,
      last: data[data.length - 1].y,
      minY: minThreshold != null ? yFor(minThreshold) : null,
      maxY: maxThreshold != null ? yFor(maxThreshold) : null,
      gridYs: [0, 1, 2, 3].map((index) => PADDING_Y + (index * plotHeight) / 3),
    };
  }, [data, width, height, minThreshold, maxThreshold]);

  if (data.length < 2) {
    return (
      <ThemedView type="backgroundElement" style={[styles.empty, { height }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Pas encore assez de données
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView
      type="backgroundElement"
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {chart && (
        <>
          <Canvas style={StyleSheet.absoluteFill}>
            {chart.gridYs.map((y, index) => (
              <Line
                key={`grid-${index}`}
                p1={vec(PADDING_X, y)}
                p2={vec(width - PADDING_X, y)}
                color={colors.border}
                strokeWidth={1}
              />
            ))}

            {chart.minY != null && (
              <Line
                p1={vec(PADDING_X, chart.minY)}
                p2={vec(width - PADDING_X, chart.minY)}
                color={colors.muted}
                strokeWidth={1}>
                <DashPathEffect intervals={[4, 4]} />
              </Line>
            )}

            {chart.maxY != null && (
              <Line
                p1={vec(PADDING_X, chart.maxY)}
                p2={vec(width - PADDING_X, chart.maxY)}
                color={colors.muted}
                strokeWidth={1}>
                <DashPathEffect intervals={[4, 4]} />
              </Line>
            )}

            <Path path={chart.areaPath} style="fill">
              <LinearGradient
                start={vec(0, PADDING_Y)}
                end={vec(0, height - PADDING_Y)}
                colors={[`${colors.accent}33`, `${colors.accent}00`]}
              />
            </Path>

            <Path
              path={chart.linePath}
              style="stroke"
              color={colors.accent}
              strokeWidth={3}
              strokeCap="round"
              strokeJoin="round"
            />
          </Canvas>

          <ThemedView style={styles.labels} pointerEvents="none">
            <ThemedView style={styles.labelRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                {chart.max.toFixed(1)} {unit}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.label}>
                {chart.last.toFixed(1)} {unit}
              </ThemedText>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {chart.min.toFixed(1)} {unit}
            </ThemedText>
          </ThemedView>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING_X,
    paddingVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
  },
});
