import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import HapticButton from '@/components/HapticButton';
import { GlassTheme } from '@/constants/LiquidGlass';

const GOLD = '#D4AF37';

export default function LoginScreen() {
  const { signInWithEmail, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Uyarı', 'E-posta ve şifre alanları zorunludur.');
      return;
    }

    const { error } = await signInWithEmail(email.trim(), password);

    if (error) {
      Alert.alert('Giriş Başarısız', error);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>CAPSHION</Text>
          <Text style={styles.title}>Tekrar hoş geldin</Text>
          <Text style={styles.subtitle}>Devam etmek için giriş yap</Text>
        </View>

        <View style={styles.form}>
          <View
            style={[
              styles.inputOuter,
              focusedField === 'email' && styles.inputFocused,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View
            style={[
              styles.inputOuter,
              focusedField === 'password' && styles.inputFocused,
            ]}
          >
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Şifre"
                placeholderTextColor="#888"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <HapticButton
                style={styles.eyeButton}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={GlassTheme.textMuted}
                />
              </HapticButton>
            </View>
          </View>

          <HapticButton
            style={styles.submitButton}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.submitText}>Giriş Yap</Text>
            )}
          </HapticButton>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hesabın yok mu?</Text>
          <HapticButton onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.footerLink}>Kaydol</Text>
          </HapticButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brand: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
    color: GOLD,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: GlassTheme.textMain,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: GlassTheme.textMuted,
  },
  form: {
    gap: 16,
  },
  inputOuter: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: GOLD,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '400',
    color: GlassTheme.textMain,
  },
  passwordRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '400',
    color: GlassTheme.textMuted,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: GOLD,
  },
});
