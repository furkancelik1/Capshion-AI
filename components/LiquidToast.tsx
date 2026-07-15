import { GlassTheme } from "@/constants/LiquidGlass";
import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export default function LiquidToast({
  visible,
  onHide,
}: {
  visible: boolean;
  onHide: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(1500, withTiming(0, { duration: 300 })),
      );
      translateY.value = withSequence(
        withSpring(0),
        withDelay(1500, withSpring(20)),
      );
      setTimeout(onHide, 2100);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <BlurView
        intensity={GlassTheme.blurIntensity}
        tint="dark"
        style={styles.blur}
      >
        <Text style={styles.text}>Başarıyla kopyalandı! ✅</Text>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  blur: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GlassTheme.glassBorder,
  },
  text: { color: GlassTheme.textMain, fontWeight: "600" },
});
