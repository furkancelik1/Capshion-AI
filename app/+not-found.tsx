import { BlurView } from 'expo-blur';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GlassTheme } from '@/constants/LiquidGlass';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <BlurView intensity={GlassTheme.blurIntensity} tint="dark" style={styles.card}>
          <Text style={styles.title}>Bu sayfa bulunamadı.</Text>
          <Link href="/(tabs)" style={styles.link}>
            <Text style={styles.linkText}>Ana sayfaya dön</Text>
          </Link>
        </BlurView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: GlassTheme.cardBorderRadius,
    borderWidth: 1.5,
    borderColor: GlassTheme.glassBorder,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
    ...GlassTheme.cardShadow,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: GlassTheme.textMain,
    marginBottom: 20,
    textAlign: 'center',
  },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: GlassTheme.glassBg,
    borderWidth: 1.5,
    borderColor: GlassTheme.glassBorder,
    ...GlassTheme.cardShadow,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: GlassTheme.textMain,
  },
});
