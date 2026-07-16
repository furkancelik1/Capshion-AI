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
import AgeRangeSelector from '@/components/AgeRangeSelector';
import HapticButton from '@/components/HapticButton';
import { GlassTheme } from '@/constants/LiquidGlass';
import { supabase } from '@/services/supabase';

export default function RegisterScreen() {
  const { signUpWithEmail, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [ageRange, setAgeRange] = useState<string | null>(null);

  const handleRegister = async () => {
    if (password.length < 6) {
      Alert.alert('Uyarı', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Uyarı', 'Şifreler eşleşmiyor.');
      return;
    }

    const { data, error } = await signUpWithEmail(email.trim(), password);

    if (error) {
      Alert.alert('Kayıt Başarısız', error.message);
      return;
    }

    const userId = data?.user?.id;
    if (userId) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email: email.trim(),
        age_range: ageRange || null,
        credits: 5,
      });
      if (profileError) {
        console.log('Profil oluşturma hatası:', profileError.message);
      }
    }

    Alert.alert(
      'Kayıt Başarılı',
      'E-postanızı doğrulayın veya giriş yapın.',
      [{ text: 'Tamam', onPress: () => router.replace('/(tabs)') }]
    );
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
            Capshion
          </Text>
          <Text style={[styles.title, { color: GlassTheme.textMain }]}>
            Hesap Oluştur
          </Text>
          <Text style={[styles.subtitle, { color: GlassTheme.textSub }]}>
            Yaratıcı platformumuza katıl
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
                autoComplete="new-password"
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

          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.inputBlur}
          >
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, { color: GlassTheme.textMain }]}
                placeholder="Şifre Tekrar"
                placeholderTextColor={GlassTheme.textPlaceholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
                  color={GlassTheme.textMain}
                />
              </HapticButton>
            </View>
          </BlurView>

          <AgeRangeSelector value={ageRange} onChange={setAgeRange} />

          <HapticButton
            style={styles.submitButton}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={loading}
          >
            <View style={styles.submitGradient}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitText}>Kaydol</Text>
              )}
            </View>
          </HapticButton>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: GlassTheme.textSub }]}>
            Zaten hesabın var mı?
          </Text>
          <HapticButton onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.footerLink, { color: GlassTheme.textMain }]}>
              Giriş Yap
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
