import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthError, RateLimitError, useLogin } from '@/api';
import { useAuthStore } from '@/auth/auth-store';
import { loginFormSchema, type LoginFormValues } from '@/auth/login-schema';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSentinelColors } from '@/constants/sentinel-theme';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  // React Hook Form's mutable form API is not compatible with the React
  // Compiler yet. https://github.com/orgs/react-hook-form/discussions/12524
  'use no memo';

  const scheme = useColorScheme();
  const theme = useTheme();
  const colors = useSentinelColors();
  const setToken = useAuthStore((state) => state.setToken);
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { password: '' },
  });

  const submit = handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      const { token } = await login.mutateAsync(password);
      setToken(token);
      // The root Stack.Protected guard switches to the tabs once the token is set.
    } catch (error) {
      // Unexpected errors are already reported to Sentry by the MutationCache.
      if (error instanceof AuthError) {
        setServerError('Mot de passe incorrect.');
      } else if (error instanceof RateLimitError) {
        const wait = error.retryAfterSeconds;
        setServerError(
          wait
            ? `Trop de tentatives — réessayez dans ${wait} s.`
            : 'Trop de tentatives — réessayez plus tard.',
        );
      } else {
        setServerError('Connexion impossible. Vérifiez votre réseau et réessayez.');
      }
    }
  });

  const message = errors.password?.message ?? serverError;

  return (
    <ThemedView style={styles.container}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedText type="smallBold" style={[styles.eyebrow, { color: colors.muted }]}>
              CONNEXION
            </ThemedText>
            <ThemedText style={styles.title}>Sentinelle</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Entrez le mot de passe familial pour accéder à la surveillance.
            </ThemedText>

            <Controller
              control={control}
              name="password"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: message ? colors.dangerBorderStrong : colors.borderStrong,
                      color: theme.text,
                    },
                  ]}
                  value={value}
                  onChangeText={(text) => {
                    onChange(text);
                    setServerError(null);
                  }}
                  onBlur={onBlur}
                  placeholder="Mot de passe"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  editable={!isSubmitting}
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  selectionColor={colors.accent}
                  accessibilityLabel="Mot de passe"
                />
              )}
            />

            {message ? (
              <ThemedText type="small" style={[styles.error, { color: colors.danger }]}>
                {message}
              </ThemedText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              style={[
                styles.button,
                { backgroundColor: colors.accentStrong },
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={() => void submit()}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.buttonText}>Se connecter</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: Spacing.five,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: Spacing.one,
  },
  subtitle: {
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  error: {
    marginTop: Spacing.two,
    fontWeight: '700',
  },
  button: {
    borderRadius: 19,
    paddingVertical: 15,
    marginTop: Spacing.four,
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
