import { Text, TextInput, View, StyleSheet } from 'react-native';

export function ScreenTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.screenHeading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.screenSubtitle}>{subtitle}</Text>
    </View>
  );
}

export function ThresholdSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

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
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputInner}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
        />
        <Text style={styles.inputUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeading: {
    marginBottom: 18,
  },
  screenTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#5E514A',
    marginTop: 4,
  },
  screenSubtitle: {
    color: '#978A83',
    marginTop: 5,
    fontSize: 13,
  },
  eyebrow: {
    color: '#B28E83',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    padding: 13,
    borderRadius: 17,
  },
  summaryLabel: {
    color: '#A0928B',
    fontSize: 11,
  },
  summaryValue: {
    color: '#655850',
    fontWeight: '800',
    fontSize: 14,
    marginTop: 5,
  },
  inputBlock: {
    flex: 1,
  },
  inputLabel: {
    color: '#92847C',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 7,
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EADFD9',
    borderRadius: 16,
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: '#62554F',
    fontSize: 16,
    fontWeight: '700',
  },
  inputUnit: {
    color: '#9C8E87',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    borderRadius: 16,
    padding: 13,
  },
  statLabel: {
    color: '#A0928B',
    fontSize: 11,
  },
  statValue: {
    marginTop: 3,
    color: '#62554E',
    fontWeight: '800',
    fontSize: 16,
  },
});
