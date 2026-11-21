import { StyleSheet, Text } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RoomStateKind = 'alert' | 'warning' | 'good' | 'calm';

const emojiFor = (kind: RoomStateKind) => {
  if (kind === 'alert') return '🚨';
  if (kind === 'warning') return '🌙';
  if (kind === 'good') return '🧸';
  return '☁️';
};

export function StateCard({
  kind,
  title,
  text,
}: {
  kind: RoomStateKind;
  title: string;
  text: string;
}) {
  const colors = useSentinelColors();
  const theme = useTheme();

  const tone =
    kind === 'alert'
      ? { background: colors.dangerSoft, border: colors.dangerBorderStrong }
      : kind === 'warning'
        ? { background: colors.warningSoft, border: colors.warningBorderStrong }
        : kind === 'good'
          ? { background: colors.successSoft, border: colors.successBorderStrong }
          : { background: theme.backgroundSelected, border: colors.borderSelected };

  return (
    <ThemedView style={[styles.card, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <Text style={styles.emoji}>{emojiFor(kind)}</Text>
      <ThemedView style={[styles.text, styles.transparent]}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {text}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.four,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  emoji: {
    fontSize: 34,
    marginRight: Spacing.three,
  },
  text: {
    flex: 1,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  body: {
    marginTop: Spacing.half,
  },
});
