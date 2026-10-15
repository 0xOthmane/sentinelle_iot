import { StyleSheet, Text, View } from 'react-native';

export function MetricCard({
  emoji,
  label,
  value,
  unit,
  min,
  max,
}: {
  emoji: string;
  label: string;
  value: number | null;
  unit: string;
  min: number | null;
  max: number | null;
}) {
  const outside =
    value != null &&
    ((min != null && value < min) || (max != null && value > max));

  return (
    <View
      style={[styles.metricCard, outside && styles.metricCardWarning]}
    >
      <Text style={styles.metricEmoji}>{emoji}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value == null ? '--' : value.toFixed(1)}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
      <Text style={styles.metricRange}>
        Confort : {min ?? '—'} – {max ?? '—'} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0E7E2',
  },
  metricCardWarning: {
    backgroundColor: '#FFF5E8',
    borderColor: '#F0D2A8',
  },
  metricEmoji: {
    fontSize: 25,
  },
  metricLabel: {
    color: '#998B84',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 3,
    fontSize: 27,
    fontWeight: '800',
    color: '#5C504A',
  },
  metricUnit: {
    fontSize: 15,
    color: '#877A73',
    fontWeight: '600',
  },
  metricRange: {
    marginTop: 8,
    color: '#A2948D',
    fontSize: 10,
  },
});
