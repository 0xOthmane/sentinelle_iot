import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/auth/AuthProvider';
import { APP_NAME } from '@/constants/config';
import { AuthError, RateLimitError } from '@/api/client';

export default function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await login(password);
      // Router guard in _layout.tsx redirects to /(tabs) on token set.
    } catch (e) {
      if (e instanceof AuthError) {
        setError('Mot de passe incorrect.');
      } else if (e instanceof RateLimitError) {
        const wait = e.retryAfterSeconds;
        setError(
          wait
            ? `Trop de tentatives — réessayez dans ${wait} s.`
            : 'Trop de tentatives — réessayez plus tard.',
        );
      } else {
        setError('Serveur injoignable — vérifiez la connexion.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.eyebrow}>CONNEXION</Text>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>
        Entrez le mot de passe familial pour accéder à la surveillance.
      </Text>

      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        onSubmitEditing={() => void submit()}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (busy || !password) && styles.buttonDisabled]}
        onPress={() => void submit()}
        disabled={busy || !password}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#A0938B',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 2,
  },
  title: {
    color: '#5E524C',
    fontWeight: '800',
    fontSize: 32,
    marginTop: 8,
  },
  subtitle: {
    color: '#94867F',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EADFD9',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#62554F',
  },
  error: {
    color: '#B3261E',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#C88678',
    borderRadius: 19,
    paddingVertical: 15,
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 15,
  },
});
