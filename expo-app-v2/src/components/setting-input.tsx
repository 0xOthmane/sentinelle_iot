import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SettingInput({
  label,
  value,
  unit,
  onChangeText,
}: {
  label: string;
  value: string;
  unit: string;
  onChangeText: (value: string) => void;
}) {
  const colors = useSentinelColors();
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.block}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedView
        style={[styles.inner, { backgroundColor: theme.background, borderColor: colors.borderStrong }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectionColor={colors.accent}
          placeholderTextColor={colors.muted}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
          {unit}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    marginBottom: 7,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
  },
});
