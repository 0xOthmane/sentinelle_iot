import { StyleSheet, Switch, Text, View } from 'react-native';

export function LedCard({
  ledOn,
  ledPending,
  networkConnected,
  onToggle,
}: {
  ledOn: boolean;
  ledPending: boolean;
  networkConnected: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.eyebrow}>VEILLEUSE</Text>
          <Text style={styles.cardTitle}>Lumière de la chambre</Text>
        </View>
        <Text style={styles.bigEmoji}>{ledOn ? '💡' : '🌙'}</Text>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 14 }}>
          <Text style={styles.switchTitle}>
            {ledOn ? 'Allumée' : 'Éteinte'}
          </Text>
          <Text style={styles.switchSubtitle}>
            {ledPending
              ? !networkConnected
                ? 'Commande enregistrée — attente du réseau'
                : 'Commande envoyée — attente de confirmation'
              : 'État confirmé par le boîtier'}
          </Text>
        </View>

        <Switch
          value={ledOn}
          onValueChange={onToggle}
          trackColor={{ false: '#E5DDD8', true: '#F1C6BB' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {ledPending && (
        <View style={styles.pending}>
          <Text style={styles.pendingText}>⏳ En attente de confirmation</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E7E2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#B28E83',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: '#5E524C',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 3,
  },
  bigEmoji: {
    fontSize: 30,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#62564F',
  },
  switchSubtitle: {
    marginTop: 4,
    color: '#94867F',
    fontSize: 12,
    lineHeight: 17,
  },
  pending: {
    marginTop: 14,
    backgroundColor: '#FFF0D8',
    borderRadius: 15,
    padding: 11,
  },
  pendingText: {
    color: '#9A7442',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
  },
});
