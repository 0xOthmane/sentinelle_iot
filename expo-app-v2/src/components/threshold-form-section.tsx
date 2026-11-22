import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Card, CardHeader } from '@/components/card';
import { SettingInput } from '@/components/setting-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ThresholdForm } from '@/types';
import { thresholdFormSchema } from '@/utils/thresholds';

export function ThresholdFormSection({
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
});