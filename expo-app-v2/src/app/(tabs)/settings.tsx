import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';

import { usePutThresholds, useThresholds } from '@/api';
import { useAuthStore } from '@/auth/auth-store';
import { Card, CardHeader } from '@/components/card';
import { ScreenShell } from '@/components/screen-shell';
import { ScreenTitle } from '@/components/screen-title';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { SettingInput } from '@/components/setting-input';
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
  thresholdFormSchema,
  thresholdsToForm,
} from '@/utils/thresholds';

const THEME_OPTIONS: readonly SegmentOption<ThemeMode>[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

function ThresholdFormSection({
  defaults,
  isSaving,
  onSubmit,
}: {
  defaults: ThresholdForm;
  isSaving: boolean;
  onSubmit: (values: ThresholdForm) => Promise<boolean>;
}) {
  // React Hook Form's mutable form API is not compatible with the React
  // Compiler yet. https://github.com/orgs/react-hook-form/discussions/12524
  'use no memo';

  const colors = useSentinelColors();
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ThresholdForm>({
    resolver: zodResolver(thresholdFormSchema),
    defaultValues: defaults,
  });

  const canSave = isDirty && !isSubmitting && !isSaving;
  const submit = handleSubmit(async (values) => {
    const saved = await onSubmit(values);
    if (saved) reset(values);
  });

  const fieldError = (message: string | undefined) =>
    message ? (
      <ThemedText type="small" style={[styles.error, { color: colors.danger }]}>
        {message}
      </ThemedText>
    ) : null;

  return (
    <>
      <Card>
        <CardHeader eyebrow="Seuils de confort" title="Température" />

        <ThemedView type="backgroundElement" style={styles.inputRow}>
          <Controller
            control={control}
            name="tMin"
            render={({ field: { onChange, value } }) => (
              <SettingInput
                label="Minimum"
                value={value}
                unit="°C"
                onChangeText={onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="tMax"
            render={({ field: { onChange, value } }) => (
              <SettingInput
                label="Maximum"
                value={value}
                unit="°C"
                onChangeText={onChange}
              />
            )}
          />
        </ThemedView>
        {fieldError(errors.tMin?.message ?? errors.tMax?.message)}

        <ThemedText style={styles.subTitle}>Humidité</ThemedText>

        <ThemedView type="backgroundElement" style={styles.inputRow}>
          <Controller
            control={control}
            name="hMin"
            render={({ field: { onChange, value } }) => (
              <SettingInput
                label="Minimum"
                value={value}
                unit="%"
                onChangeText={onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="hMax"
            render={({ field: { onChange, value } }) => (
              <SettingInput
                label="Maximum"
                value={value}
                unit="%"
                onChangeText={onChange}
              />
            )}
          />
        </ThemedView>
        {fieldError(errors.hMin?.message ?? errors.hMax?.message)}
      </Card>

      <Card>
        <CardHeader eyebrow="Temporisation" title="Délai avant alerte" />
        <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
          Le dépassement doit durer ce temps avant de devenir une alerte.
        </ThemedText>

        <Controller
          control={control}
          name="holdSeconds"
          render={({ field: { onChange, value } }) => (
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
                value={value}
                keyboardType="number-pad"
                onChangeText={onChange}
                selectionColor={colors.accent}
                placeholderTextColor={colors.muted}
              />
              <ThemedText
                type="smallBold"
                themeColor="textSecondary"
                style={styles.durationUnit}>
                secondes
              </ThemedText>
            </ThemedView>
          )}
        />
        {fieldError(errors.holdSeconds?.message)}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          style={[
            styles.saveButton,
            {
              backgroundColor: canSave
                ? colors.accentStrong
                : theme.backgroundSelected,
              borderColor: colors.borderStrong,
            },
          ]}
          onPress={() => void submit()}>
          {isSubmitting || isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText
              style={[
                styles.saveButtonText,
                { color: canSave ? '#FFFFFF' : theme.textSecondary },
              ]}>
              Enregistrer les réglages
            </ThemedText>
          )}
        </Pressable>
      </Card>
    </>
  );
}

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
  error: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
  saveButton: {
    borderRadius: 19,
    borderWidth: 1,
    paddingVertical: 15,
    marginTop: 18,
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
