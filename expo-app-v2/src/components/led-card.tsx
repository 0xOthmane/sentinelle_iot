import { StyleSheet, Switch } from 'react-native';

import { Card, CardHeader } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LedCard({
  ledOn,
  ledPending,
  networkConnected,
  onToggle,
}: {
  ledOn: boolean;
  ledPending: boolean;
  networkConnected: boolean;
  onToggle: (value: boolean) => void;
}) {
  const colors = useSentinelColors();
  const theme = useTheme();

  const subtitle = ledPending
    ? networkConnected
      ? 'Commande en cours d’envoi'
      : 'Commande enregistrée — attente du réseau'
    : 'Commande transmise au boîtier';

  return (
    <Card>
      <CardHeader
        eyebrow="Veilleuse"
        title="Lumière de la chambre"
        right={
          <ThemedText style={styles.bigEmoji}>{ledOn ? '💡' : '🌙'}</ThemedText>
        }
      />

      <ThemedView type="backgroundElement" style={styles.switchRow}>
        <ThemedView type="backgroundElement" style={styles.switchText}>
          <ThemedText style={styles.switchTitle}>{ledOn ? 'Allumée' : 'Éteinte'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.switchSubtitle}>
            {subtitle}
          </ThemedText>
        </ThemedView>

        <Switch
          value={ledOn}
          onValueChange={onToggle}
          trackColor={{ false: theme.backgroundSelected, true: colors.accentStrong }}
          thumbColor="#FFFFFF"
        />
      </ThemedView>

      {ledPending && (
        <ThemedView
          style={[
            styles.pending,
            { backgroundColor: colors.warningSoft, borderColor: colors.warningBorderStrong },
          ]}>
          <ThemedText type="small" style={[styles.pendingText, { color: colors.warning }]}>
            ⏳ En attente de confirmation
          </ThemedText>
        </ThemedView>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  bigEmoji: {
    fontSize: 30,
    lineHeight: 36,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchText: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  switchSubtitle: {
    marginTop: Spacing.half,
    fontSize: 12,
    lineHeight: 17,
  },
  pending: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: 11,
  },
  pendingText: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
  },
});
