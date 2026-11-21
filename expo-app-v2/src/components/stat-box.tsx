import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StatBox({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <ThemedView style={[styles.box, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: 13,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
  },
  value: {
    marginTop: 3,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
});
