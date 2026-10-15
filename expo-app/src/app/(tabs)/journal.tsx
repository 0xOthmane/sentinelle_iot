import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { ScreenTitle } from '@/components/common';
import { useSentinelle } from '@/state/SentinelleProvider';
import { formatDateTime, journalIcon } from '@/utils/format';

export default function JournalScreen() {
  const { journalItems, refreshJournal } = useSentinelle();

  useFocusEffect(
    useCallback(() => {
      void refreshJournal();
    }, [refreshJournal]),
  );

  return (
    <ScreenShell>
      <ScreenTitle
        eyebrow="JOURNAL"
        title="Ce qui s’est passé"
        subtitle="Alertes, connexions et commandes."
      />

      <View style={styles.card}>
        {journalItems.length === 0 ? (
          <Text style={styles.emptyText}>Aucun événement enregistré.</Text>
        ) : (
          journalItems.map((item) => (
            <View key={item.id} style={styles.journalRow}>
              <View style={styles.journalIcon}>
                <Text>{journalIcon(item.type)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.journalMessage}>{item.message}</Text>
                <Text style={styles.journalDate}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScreenShell>
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
  emptyText: {
    color: '#A1948D',
    textAlign: 'center',
  },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E8E3',
  },
  journalIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF4F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  journalMessage: {
    color: '#675A53',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  journalDate: {
    color: '#A2948D',
    fontSize: 10,
    marginTop: 4,
  },
});
