import { BackHandler, Modal, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useEffect, useRef } from "react";
import { GlassTheme } from "@/constants/LiquidGlass";

interface AILoadingOverlayProps {
  visible: boolean;
}

function BreathingCore() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1400 }),
        withTiming(0.85, { duration: 1400 }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0.5, { duration: 1400 }),
      ),
      -1,
      true,
    );
    ringScale.value = withRepeat(
      withTiming(1.6, { duration: 2400 }),
      -1,
      false,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(0.35, { duration: 100 }),
        withTiming(0, { duration: 2300 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
    };
  }, []);

  const outerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <View style={styles.coreContainer}>
      <Animated.View style={[styles.ripple, ringStyle]} />
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
        withTiming(0.55, { duration: 1300 }),
        withTiming(1, { duration: 1300 }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
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

  // İşlem sürerken Android donanım geri tuşu ekranı kapatamasın / iptal edemesin.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={["#07080B", "#0D0F13", "#050607"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <BreathingCore />
          <View style={styles.textGroup}>
            <PulsingText text={t("generating.title")} />
            <Animated.Text style={styles.subtitle}>
              {t("generating.subtitle")}
            </Animated.Text>
          </View>
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
    gap: 40,
    paddingHorizontal: 32,
  },
  textGroup: {
    alignItems: "center",
    gap: 10,
  },
  coreContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  ripple: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.4)",
  },
  glowOuter: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(52, 199, 89, 0.12)",
  },
  glowInner: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(52, 199, 89, 0.22)",
  },
  coreDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GlassTheme.primary,
    shadowColor: GlassTheme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#F5F5F0",
    letterSpacing: 0.5,
    textAlign: "center",
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(245, 245, 240, 0.5)",
    letterSpacing: 0.3,
    textAlign: "center",
    lineHeight: 19,
  },
});
