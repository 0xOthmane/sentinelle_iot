import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
} from 'react-native';

import { usePutThresholds, useThresholds } from '@/api';
import { useAuthStore } from '@/auth/auth-store';
import { Card, CardHeader } from '@/components/card';
import { ScreenShell } from '@/components/screen-shell';
import { ScreenTitle } from '@/components/screen-title';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { ThresholdFormSection } from '@/components/threshold-form-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME, DEVICE_ID } from '@/constants/config';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLiveStore } from '@/stores/live-store';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
import type { ThresholdForm } from '@/types';
import { connectionLabel, isLiveConnected } from '@/utils/room-state';
import {
  formToThresholds,
  thresholdsToForm,
} from '@/utils/thresholds';

const THEME_OPTIONS: readonly SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export default function SettingsScreen() {
  const colors = useSentinelColors();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);

  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  const thresholdsQuery = useThresholds(DEVICE_ID);
  const saveThresholds = usePutThresholds(DEVICE_ID);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const connection = useLiveStore((state) => state.connection);
  const deviceStatus = useLiveStore((state) => state.deviceStatus);
  const statusLabel = connectionLabel(connection, deviceStatus);
  const online = isLiveConnected(connection, deviceStatus);

  const handleSave = async (values: ThresholdForm): Promise<boolean> => {
    try {
      await saveThresholds.mutateAsync(formToThresholds(values));
      Alert.alert('Réglages', 'Les seuils ont été mis à jour.');
      return true;
    } catch {
      // The mutation cache reports the exception; keep the feedback generic.
      Alert.alert(
        'Réglages',
        'Les seuils n’ont pas pu être enregistrés. Réessaie.',
      );
      return false;
    }
  };

  const savedForm = thresholdsQuery.data
    ? thresholdsToForm(thresholdsQuery.data.value)
    : null;

  return (
    <ScreenShell title={APP_NAME} statusLabel={statusLabel} online={online}>
      <ScreenTitle
        eyebrow="RÉGLAGES"
        title="Seuils et alertes"
        subtitle="Adapte la surveillance de la chambre."
      />

      <Card>
        <CardHeader eyebrow="Apparence" title="Thème" />
        <SegmentedControl options={THEME_OPTIONS} value={themeMode} onChange={setThemeMode} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          « Système » suit le réglage clair/sombre de l&apos;appareil.
        </ThemedText>
      </Card>

      {savedForm ? (
        <ThresholdFormSection
          key={JSON.stringify(savedForm)}
          defaults={savedForm}
          isSaving={saveThresholds.isPending}
          onSubmit={handleSave}
        />
      ) : (
        <Card>
          <CardHeader eyebrow="Seuils de confort" title="Surveillance" />
          <ThemedText type="small" themeColor="textSecondary">
            {thresholdsQuery.isPending
              ? 'Chargement des seuils…'
              : 'Impossible de charger les seuils.'}
          </ThemedText>
        </Card>
      )}

      <Card>
        <CardHeader eyebrow="Alertes" title="Notifications locales" />

        <ThemedView type="backgroundElement" style={styles.switchRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.switchDescription}>
            La permission est demandée uniquement lorsque tu actives cette option.
          </ThemedText>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: theme.backgroundSelected, true: colors.accentStrong }}
            thumbColor="#FFFFFF"
          />
        </ThemedView>
      </Card>

      <Pressable
        accessibilityRole="button"
        style={[styles.logoutButton, { borderColor: colors.borderStrong }]}
        onPress={() => {
          void signOut();
          queryClient.clear();
        }}>
        <ThemedText style={[styles.logoutButtonText, { color: colors.danger }]}>
          Se déconnecter
        </ThemedText>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 12,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchDescription: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  logoutButton: {
    borderRadius: 19,
    borderWidth: 1,
    paddingVertical: 15,
    marginBottom: 14,
  },
  logoutButtonText: {
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
  },
});