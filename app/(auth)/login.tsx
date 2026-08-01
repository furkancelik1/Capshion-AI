import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/services/supabase';
import { usePostHog } from 'posthog-react-native';
import AmbientGlow from '@/components/AmbientGlow';
import GlassPanel from '@/components/GlassPanel';
import HapticButton from '@/components/HapticButton';
import { GlassTheme } from '@/constants/LiquidGlass';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, loading } = useAuth();
  const { showToast } = useToast();
  const posthog = usePostHog();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleSocialAuth = useCallback(async (provider: 'apple' | 'google', idToken: string) => {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider, token: idToken });
    if (error) throw error;
    const email = data.user?.email;
    if (!email) throw new Error('E-posta alınamadı.');
    const { error: loginError } = await signInWithEmail(email, 'social_capshion_2024');
    if (loginError) {
      const { error: regError } = await signUpWithEmail(email, 'social_capshion_2024');
      if (regError) throw regError;
    }
    showToast('Giriş başarılı!', 'success');
    router.replace('/(tabs)');
  }, [signInWithEmail, signUpWithEmail, showToast]);

  const handleAppleLogin = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const AppleAuthentication = require('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple identity token alınamadı.');
      await handleSocialAuth('apple', credential.identityToken);
    } catch (err: any) {
      if (err.code !== 'ERR_CANCELED') {
        showToast(err.message || 'Apple ile giriş yapılamadı.', 'error');
      }
    }
  }, [showToast, handleSocialAuth]);

  const handleGoogleLogin = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: 'BURAYA_GOOGLE_WEB_CLIENT_ID_GELECEK',
        iosClientId: 'BURAYA_IOS_CLIENT_ID_GELECEK',
      });
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (!userInfo.idToken) throw new Error('Google ID token alınamadı.');
      await handleSocialAuth('google', userInfo.idToken);
    } catch (err: any) {
      showToast(err.message || 'Google ile giriş yapılamadı.', 'error');
    }
  }, [showToast, handleSocialAuth]);

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

    posthog?.capture('kullanici_giris_yapti', { method: 'email' });
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientGlow />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>CAPSHION</Text>
          <Text style={styles.title}>Tekrar hoş geldin</Text>
          <Text style={styles.subtitle}>Devam etmek için giriş yap</Text>
        </View>

        <GlassPanel style={styles.formWrap}>
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
                placeholderTextColor={GlassTheme.textPlaceholder}
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
                  placeholderTextColor={GlassTheme.textPlaceholder}
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
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Giriş Yap</Text>
              )}
            </HapticButton>
          </View>
        </GlassPanel>

        {/* ── Social Login Divider ── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Veya şununla devam et</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Social Buttons ── */}
        <View style={styles.socialRow}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleAppleLogin}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
              <Text style={styles.socialBtnText}>Apple ile Giriş Yap</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.socialBtn}
            onPress={handleGoogleLogin}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.socialBtnText}>Google ile Giriş Yap</Text>
          </TouchableOpacity>
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
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 12,
  },
  brand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: GlassTheme.neonPlatinum,
    marginBottom: 20,
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
  formWrap: {
    padding: 4,
  },
  form: {
    gap: 14,
    padding: 16,
  },
  inputOuter: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: GlassTheme.primary,
    borderWidth: 1.5,
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
    borderRadius: 999,
    backgroundColor: GlassTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  socialRow: {
    gap: 12,
    marginBottom: 8,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
    color: GlassTheme.primary,
  },
});
