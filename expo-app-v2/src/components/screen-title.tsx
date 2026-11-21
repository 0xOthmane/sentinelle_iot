import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';

export function ScreenTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const colors = useSentinelColors();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="code" style={[styles.eyebrow, { color: colors.accentText }]}>
        {eyebrow}
      </ThemedText>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        {subtitle}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: Spacing.half,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.one,
  },
});
