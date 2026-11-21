import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StatusPill({ label, online }: { label: string; online: boolean }) {
  const colors = useSentinelColors();
  const theme = useTheme();
  const tint = online ? colors.success : colors.muted;

  return (
    <ThemedView
      style={[
        styles.pill,
        { backgroundColor: online ? colors.successSoft : theme.backgroundSelected },
      ]}>
      <ThemedView style={[styles.dot, { backgroundColor: tint }]} />
      <ThemedText type="small" style={[styles.label, { color: tint }]}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
