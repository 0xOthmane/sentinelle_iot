import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';

export function Card({ children }: { children: ReactNode }) {
  const colors = useSentinelColors();

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: colors.border }]}>
      {children}
    </ThemedView>
  );
}

export function CardHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.header}>
      <ThemedView type="backgroundElement" style={styles.headerText}>
        <ThemedText type="code" themeColor="textSecondary" style={styles.eyebrow}>
          {eyebrow}
        </ThemedText>
        <ThemedText style={styles.title}>{title}</ThemedText>
      </ThemedView>
      {right}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: Spacing.half,
  },
});
