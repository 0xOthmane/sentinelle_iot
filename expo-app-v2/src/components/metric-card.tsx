import { StyleSheet, Text } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const colors = useSentinelColors();
  const theme = useTheme();

  const outside =
    value != null && ((min != null && value < min) || (max != null && value > max));

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: outside ? colors.warningSoft : theme.backgroundElement,
          borderColor: outside ? colors.warningBorderStrong : colors.border,
        },
      ]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText style={styles.value}>
        {value == null ? '--' : value.toFixed(1)}
        <ThemedText type="small" themeColor="textSecondary">
          {' '}
          {unit}
        </ThemedText>
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.range}>
        Confort : {min ?? '—'} – {max ?? '—'} {unit}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.three,
  },
  emoji: {
    fontSize: 25,
  },
  label: {
    marginTop: Spacing.two,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    marginTop: Spacing.half,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
  },
  range: {
    marginTop: Spacing.two,
    fontSize: 10,
    lineHeight: 14,
  },
});
