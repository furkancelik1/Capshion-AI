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
import AgeRangeSelector from '@/components/AgeRangeSelector';
import HapticButton from '@/components/HapticButton';
import { GlassTheme } from '@/constants/LiquidGlass';
import { api } from '@/services/api';

const GOLD = '#D4AF37';

export default function RegisterScreen() {
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'confirmPassword' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (password.length < 6) {
      Alert.alert('Uyarı', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Uyarı', 'Şifreler eşleşmiyor.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await signUpWithEmail(email.trim(), password, ageRange);

      if (error) {
        Alert.alert('Kayıt Başarısız', error);
        return;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Kayıt Başarısız', err.message || 'Bilinmeyen bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
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
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>Yaratıcı platformumuza katıl</Text>
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
                autoComplete="new-password"
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

          <View
            style={[
              styles.inputOuter,
              focusedField === 'confirmPassword' && styles.inputFocused,
            ]}
          >
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Şifre Tekrar"
                placeholderTextColor="#888"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <HapticButton
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={GlassTheme.textMuted}
                />
              </HapticButton>
            </View>
          </View>

          <AgeRangeSelector value={ageRange} onChange={setAgeRange} />

          <HapticButton
            style={styles.submitButton}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.submitText}>Kaydol</Text>
            )}
          </HapticButton>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zaten hesabın var mı?</Text>
          <HapticButton onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>Giriş Yap</Text>
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
