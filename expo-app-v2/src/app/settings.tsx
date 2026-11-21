import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput } from 'react-native';

import { Card, CardHeader } from '@/components/card';
import { ScreenShell } from '@/components/screen-shell';
import { ScreenTitle } from '@/components/screen-title';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { SettingInput } from '@/components/setting-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';

type ThresholdForm = {
  tMin: string;
  tMax: string;
  hMin: string;
  hMax: string;
  holdSeconds: string;
};

const INITIAL_FORM: ThresholdForm = {
  tMin: '19',
  tMax: '24',
  hMin: '40',
  hMax: '60',
  holdSeconds: '30',
};

const THEME_OPTIONS: readonly SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export default function SettingsScreen() {
  const colors = useSentinelColors();
  const theme = useTheme();

  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  const [form, setForm] = useState<ThresholdForm>(INITIAL_FORM);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const dirty = (Object.keys(INITIAL_FORM) as (keyof ThresholdForm)[]).some(
    (key) => form[key] !== INITIAL_FORM[key],
  );

  const setField = (key: keyof ThresholdForm) => (value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  return (
    <ScreenShell title="Sentinelle" statusLabel="Connecté" online>
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

      <Card>
        <CardHeader eyebrow="Seuils de confort" title="Température" />

        <ThemedView type="backgroundElement" style={styles.inputRow}>
          <SettingInput
            label="Minimum"
            value={form.tMin}
            unit="°C"
            onChangeText={setField('tMin')}
          />
          <SettingInput
            label="Maximum"
            value={form.tMax}
            unit="°C"
            onChangeText={setField('tMax')}
          />
        </ThemedView>

        <ThemedText style={styles.subTitle}>Humidité</ThemedText>

        <ThemedView type="backgroundElement" style={styles.inputRow}>
          <SettingInput
            label="Minimum"
            value={form.hMin}
            unit="%"
            onChangeText={setField('hMin')}
          />
          <SettingInput
            label="Maximum"
            value={form.hMax}
            unit="%"
            onChangeText={setField('hMax')}
          />
        </ThemedView>
      </Card>

      <Card>
        <CardHeader eyebrow="Temporisation" title="Délai avant alerte" />
        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          Le dépassement doit durer ce temps avant de devenir une alerte.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.durationWrap}>
          <TextInput
            style={[
              styles.durationInput,
              {
                backgroundColor: theme.background,
                borderColor: colors.borderStrong,
                color: theme.text,
              },
            ]}
            value={form.holdSeconds}
            keyboardType="decimal-pad"
            onChangeText={setField('holdSeconds')}
            selectionColor={colors.accent}
            placeholderTextColor={colors.muted}
          />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.durationUnit}>
            secondes
          </ThemedText>
        </ThemedView>
      </Card>

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

      {dirty && (
        <ThemedView
          style={[
            styles.syncBox,
            { backgroundColor: colors.warningSoft, borderColor: colors.warningBorderStrong },
          ]}>
          <ThemedText type="small" style={[styles.syncText, { color: colors.warning }]}>
            ☁️ Des seuils attendent leur synchronisation.
          </ThemedText>
        </ThemedView>
      )}

      {/* TODO: wire these to the backend once it lands. */}
      <Pressable
        disabled
        accessibilityState={{ disabled: true }}
        style={[
          styles.saveButton,
          { backgroundColor: theme.backgroundSelected, borderColor: colors.borderStrong },
        ]}>
        <ThemedText themeColor="textSecondary" style={styles.saveButtonText}>
          Enregistrer les réglages
        </ThemedText>
      </Pressable>

      <Pressable
        disabled
        accessibilityState={{ disabled: true }}
        style={[styles.logoutButton, { borderColor: colors.borderStrong }]}>
        <ThemedText themeColor="textSecondary" style={styles.logoutButtonText}>
          Se déconnecter
        </ThemedText>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 13,
  },
  subTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: 26,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
  },
  durationWrap: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationInput: {
    width: 85,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
  durationUnit: {
    marginLeft: 10,
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
  syncBox: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: 13,
    marginBottom: 13,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    borderRadius: 19,
    borderWidth: 1,
    paddingVertical: 15,
    marginBottom: 14,
  },
  saveButtonText: {
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
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
