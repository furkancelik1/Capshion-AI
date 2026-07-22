import { Dimensions, Modal, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { GlassTheme } from "@/constants/LiquidGlass";

const { width } = Dimensions.get("window");

interface AILoadingOverlayProps {
  visible: boolean;
}

function BreathingCore() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1200 }),
        withTiming(0.85, { duration: 1200 }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.5, { duration: 1200 }),
      ),
      -1,
      true,
    );
  }, []);

  const outerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.coreContainer}>
      <Animated.View style={[styles.glowOuter, outerGlowStyle]} />
      <Animated.View style={[styles.glowInner, innerGlowStyle]} />
      <View style={styles.coreDot} />
    </View>
  );
}

function PulsingText({ text }: { text: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1,
      true,
    );
  }, []);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.loadingText, textStyle]}>
      {text}
    </Animated.Text>
  );
}

export default function AILoadingOverlay({ visible }: AILoadingOverlayProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <BlurView
          intensity={60}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <BreathingCore />
          <PulsingText text={t("generating.title")} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 32,
  },
  coreContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  glowInner: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(139, 92, 246, 0.25)",
  },
  coreDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GlassTheme.primary,
    shadowColor: GlassTheme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
    color: GlassTheme.neonPlatinum,
    letterSpacing: 2,
    textAlign: "center",
  },
});
