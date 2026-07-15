import { BlurView } from 'expo-blur';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { GlassTheme } from '@/constants/LiquidGlass';

interface LiquidLoadingProps {
  message?: string;
}

export default function LiquidLoading({
  message = 'Açıklamalar oluşturuluyor...',
}: LiquidLoadingProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView
        intensity={GlassTheme.blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <LottieView
          source={{ uri: 'https://assets9.lottiefiles.com/packages/lf20_t24y4c9a.json' }}
          style={styles.lottie}
          autoPlay
          loop
        />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 160,
    height: 160,
  },
  message: {
    fontSize: 15,
    fontWeight: GlassTheme.bodyWeight,
    color: GlassTheme.textMain,
    marginTop: 16,
  },
});
