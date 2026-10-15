import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { Measurement } from '@/types';

export function SoftChart({
  data,
  valueKey,
  unit,
  minThreshold,
  maxThreshold,
}: {
  data: Measurement[];
  valueKey: 't' | 'h';
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
}) {
  const width = 320;
  const height = 190;

  if (data.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>Pas encore assez de données</Text>
      </View>
    );
  }

  const values = data.map((item) => item[valueKey]);
  const thresholdValues = [
    ...(minThreshold != null ? [minThreshold] : []),
    ...(maxThreshold != null ? [maxThreshold] : []),
  ];

  const minBase = Math.min(...values, ...thresholdValues);
  const maxBase = Math.max(...values, ...thresholdValues);
  const padding = Math.max((maxBase - minBase) * 0.15, 0.5);
  const min = minBase - padding;
  const max = maxBase + padding;
  const range = max - min || 1;

  const yFor = (value: number) =>
    height - 30 - ((value - min) / range) * (height - 60);

  const points = data
    .map((item, index) => {
      const x =
        14 + (index / Math.max(data.length - 1, 1)) * (width - 28);
      return `${x},${yFor(item[valueKey])}`;
    })
    .join(' ');

  const last = data[data.length - 1];

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((index) => {
          const y = 25 + index * 45;
          return (
            <Line
              key={index}
              x1="14"
              x2="306"
              y1={y}
              y2={y}
              stroke="#EFE7E2"
              strokeWidth="1"
            />
          );
        })}

        {minThreshold != null && (
          <Line
            x1="14"
            x2="306"
            y1={yFor(minThreshold)}
            y2={yFor(minThreshold)}
            stroke="#D8C8BF"
            strokeDasharray="4 4"
          />
        )}

        {maxThreshold != null && (
          <Line
            x1="14"
            x2="306"
            y1={yFor(maxThreshold)}
            y2={yFor(maxThreshold)}
            stroke="#D8C8BF"
            strokeDasharray="4 4"
          />
        )}

        <Polyline
          points={points}
          fill="none"
          stroke="#C98072"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <SvgText x="14" y="18" fontSize="11" fill="#9A8A82">
          {max.toFixed(1)} {unit}
        </SvgText>

        <SvgText x="14" y={height - 8} fontSize="11" fill="#9A8A82">
          {min.toFixed(1)} {unit}
        </SvgText>

        <SvgText
          x="306"
          y="18"
          fontSize="12"
          textAnchor="end"
          fill="#6C605A"
          fontWeight="600"
        >
          {last[valueKey].toFixed(1)} {unit}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyChart: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#A1948D',
    textAlign: 'center',
  },
  chartWrap: {
    marginTop: 10,
  },
});
