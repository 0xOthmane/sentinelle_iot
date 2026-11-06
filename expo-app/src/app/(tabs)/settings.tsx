import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { ScreenTitle, SettingInput } from '@/components/common';
import { API_URL, DEVICE_ID, WS_URL } from '@/constants/config';
import { probeWsConnection } from '@/api/wsProbe';
import { getWsTraceLines } from '@/utils/wsTrace';
import { useAuth } from '@/hooks/useAuth';
import { useSentinelle } from '@/hooks/useSentinelle';
import * as Sentry from '@sentry/react-native';

export default function SettingsScreen() {
  const { logout } = useAuth();
  const {
    thresholdForm,
    setThresholdForm,
    thresholdLoading,
    thresholdDirty,
    notificationsEnabled,
    toggleNotifications,
    saveThresholdSettings,
    backendOnline,
    networkConnected,
    wsStatus,
    wsStatusSince,
    forceWsReconnect,
  } = useSentinelle();

  // Ticks so the socket-status age stays live in the diagnostic card. The
  // timestamp is sampled inside effects so the render stays pure.
  const [nowTs, setNowTs] = useState(wsStatusSince);
  const [trace, setTrace] = useState<string[]>([]);
  useEffect(() => {
    // First sample arrives with the first tick (≤1s): keeps effects clean.
    const timer = setInterval(() => {
      setNowTs(Date.now());
      setTrace(getWsTraceLines());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const socketAge = Math.max(0, Math.round((nowTs - wsStatusSince) / 1000));

  const [probeLines, setProbeLines] = useState<string[] | null>(null);
  const [probeRunning, setProbeRunning] = useState(false);

  const runProbe = useCallback(async () => {
    setProbeRunning(true);
    setProbeLines(null);
    try {
      const { lines } = await probeWsConnection(API_URL, WS_URL);
      setProbeLines(lines);
    } catch (error) {
      setProbeLines([`probe: erreur inattendue — ${String(error)}`]);
    } finally {
      setProbeRunning(false);
    }
  }, []);

  const setField = (key: keyof typeof thresholdForm) => (value: string) =>
    setThresholdForm((old) => ({ ...old, [key]: value }));

  return (
    <ScreenShell>
      <ScreenTitle
        eyebrow="RÉGLAGES"
        title="Seuils et alertes"
        subtitle="Adapte la surveillance de la chambre."
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Diagnostic réseau</Text>
        <Text style={styles.debugLine}>
          réseau : {networkConnected ? 'connecté' : 'hors ligne'} ·
          backend : {backendOnline ? 'connecté' : 'déconnecté'}
        </Text>
        <Text style={styles.debugLine}>
          socket : {wsStatus} ({socketAge}s)
        </Text>
        <Text style={styles.debugLine} numberOfLines={1}>
          device : {DEVICE_ID}
        </Text>
        <Text style={styles.debugLine} numberOfLines={1}>
          api : {API_URL}
        </Text>
        <Text style={styles.debugLine} numberOfLines={1}>
          ws : {WS_URL}
        </Text>

        {trace.length > 0 && (
          <View style={styles.traceBlock}>
            {trace.slice(0, 8).map((line, index) => (
              <Text key={index} style={styles.probeLine}>
                {line}
              </Text>
            ))}
          </View>
        )}

        <Pressable
          style={styles.probeButton}
          onPress={() => void runProbe()}
          disabled={probeRunning}
        >
          <Text style={styles.probeButtonText}>
            {probeRunning ? 'Test en cours…' : 'Tester la connexion WS'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.probeButton}
          onPress={() => forceWsReconnect()}
        >
          <Text style={styles.probeButtonText}>
            Forcer la reconnexion du socket
          </Text>
        </Pressable>
        {probeLines?.map((line, index) => (
          <Text key={index} style={styles.probeLine}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Température</Text>

        <View style={styles.inputRow}>
          <SettingInput
            label="Minimum"
            value={thresholdForm.tMin}
            unit="°C"
            onChangeText={setField('tMin')}
          />
          <SettingInput
            label="Maximum"
            value={thresholdForm.tMax}
            unit="°C"
            onChangeText={setField('tMax')}
          />
        </View>

        <Text style={[styles.cardTitle, { marginTop: 26 }]}>Humidité</Text>

        <View style={styles.inputRow}>
          <SettingInput
            label="Minimum"
            value={thresholdForm.hMin}
            unit="%"
            onChangeText={setField('hMin')}
          />
          <SettingInput
            label="Maximum"
            value={thresholdForm.hMax}
            unit="%"
            onChangeText={setField('hMax')}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Délai avant alerte</Text>
        <Text style={styles.description}>
          Le dépassement doit durer ce temps avant de devenir une alerte.
        </Text>
        <View style={styles.durationWrap}>
          <TextInput
            style={styles.durationInput}
            value={thresholdForm.holdSeconds}
            keyboardType="decimal-pad"
            onChangeText={setField('holdSeconds')}
          />
          <Text style={styles.durationUnit}>secondes</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.cardTitle}>Notifications locales</Text>
            <Text style={styles.description}>
              La permission est demandée uniquement lorsque tu actives cette
              option.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(value) => void toggleNotifications(value)}
            trackColor={{ false: '#E5DDD8', true: '#CDE3D5' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {thresholdDirty && (
        <View style={styles.syncBox}>
          <Text style={styles.syncText}>
            ☁️ Des seuils attendent leur synchronisation.
          </Text>
        </View>
      )}

      <Pressable
        style={styles.saveButton}
        onPress={() => void saveThresholdSettings()}
        disabled={thresholdLoading}
      >
        <Text style={styles.saveButtonText}>
          {thresholdLoading ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </Text>
      </Pressable>
      {/* <Button title='Try!' onPress={ () => { Sentry.captureException(new Error('First error')) }}/> */}
      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutButtonText}>Se déconnecter</Text>
      </Pressable>
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
  cardTitle: {
    color: '#5E524C',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 3,
  },
  debugLine: {
    color: '#897C75',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  probeButton: {
    backgroundColor: '#EFF5F1',
    borderWidth: 1,
    borderColor: '#CBDCCF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  probeButtonText: {
    color: '#4A6C55',
    fontWeight: '800',
    fontSize: 13,
  },
  probeLine: {
    color: '#6B5F58',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  traceBlock: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5DAD4',
    paddingTop: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 13,
  },
  description: {
    color: '#94867F',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  durationWrap: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationInput: {
    width: 85,
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#EADFD9',
    borderRadius: 16,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#62554F',
  },
  durationUnit: {
    marginLeft: 10,
    color: '#897C75',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncBox: {
    backgroundColor: '#F6ECD9',
    borderRadius: 17,
    padding: 13,
    marginBottom: 13,
  },
  syncText: {
    color: '#806C4D',
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#C88678',
    borderRadius: 19,
    paddingVertical: 15,
    marginBottom: 14,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
  },
  logoutButton: {
    borderRadius: 19,
    paddingVertical: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EADFD9',
    backgroundColor: '#FFFFFF',
  },
  logoutButtonText: {
    color: '#96695F',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
  },
});
