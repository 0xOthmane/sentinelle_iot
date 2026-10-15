import { StyleSheet, Text, View } from 'react-native';
import type { RoomState } from '@/types';

const emojiFor = (kind: RoomState['kind']) => {
  if (kind === 'alert') return '🚨';
  if (kind === 'warning') return '🌙';
  if (kind === 'good') return '🧸';
  return '☁️';
};

export function StateCard({ state }: { state: RoomState }) {
  return (
    <View
      style={[
        styles.stateCard,
        state.kind === 'alert' && styles.stateAlert,
        state.kind === 'warning' && styles.stateWarning,
      ]}
    >
      <Text style={styles.stateEmoji}>{emojiFor(state.kind)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.stateTitle}>{state.title}</Text>
        <Text style={styles.stateText}>{state.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F2EB',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D8E8DD',
  },
  stateWarning: {
    backgroundColor: '#FFF0D9',
    borderColor: '#F0D9B5',
  },
  stateAlert: {
    backgroundColor: '#FFE2DE',
    borderColor: '#F5BBB3',
  },
  stateEmoji: {
    fontSize: 34,
    marginRight: 14,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5E524C',
  },
  stateText: {
    marginTop: 4,
    color: '#84766F',
    fontSize: 13,
    lineHeight: 18,
  },
});
