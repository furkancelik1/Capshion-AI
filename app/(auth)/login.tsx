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
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import HapticButton from '@/components/HapticButton';
import { GlassTheme } from '@/constants/LiquidGlass';

export default function LoginScreen() {
  const { signInWithEmail, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Uyarı', 'E-posta ve şifre alanları zorunludur.');
      return;
    }

    const { error } = await signInWithEmail(email.trim(), password);

    if (error) {
      Alert.alert('Giriş Başarısız', error.message);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.brand, { color: GlassTheme.textSub }]}>
            Capshion AI
          </Text>
          <Text style={[styles.title, { color: GlassTheme.textMain }]}>
            Tekrar hoş geldin
          </Text>
          <Text style={[styles.subtitle, { color: GlassTheme.textSub }]}>
            Devam etmek için giriş yap
          </Text>
        </View>

        <View style={styles.form}>
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.inputBlur}
          >
            <TextInput
              style={[styles.input, { color: GlassTheme.textMain }]}
              placeholder="E-posta"
              placeholderTextColor={GlassTheme.textPlaceholder}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </BlurView>

          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.inputBlur}
          >
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, { color: GlassTheme.textMain }]}
                placeholder="Şifre"
                placeholderTextColor={GlassTheme.textPlaceholder}
                value={password}
                onChangeText={setPassword}
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
                  color={GlassTheme.textMain}
                />
              </HapticButton>
            </View>
          </BlurView>

          <HapticButton
            style={styles.submitButton}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            <View style={styles.submitGradient}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitText}>Giriş Yap</Text>
              )}
            </View>
          </HapticButton>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: GlassTheme.textSub }]}>
            Hesabın yok mu?
          </Text>
          <HapticButton onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.footerLink, { color: GlassTheme.textMain }]}>
              Kaydol
            </Text>
          </HapticButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  form: {
    gap: 16,
  },
  inputBlur: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: GlassTheme.glassBorder,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '400',
    backgroundColor: GlassTheme.glassCardBg,
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
    overflow: 'hidden',
    marginTop: 8,
    ...GlassTheme.cardShadow,
  },
  submitGradient: {
    flex: 1,
    backgroundColor: '#6A11CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
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
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
