import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GlassTheme } from "@/constants/LiquidGlass";

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

export default function AnimatedSplashScreen({
  onAnimationFinish,
}: AnimatedSplashScreenProps) {
  const containerOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(-50);
  const logoScale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(50);
  const textLetterSpacing = useSharedValue(3);

  useEffect(() => {
    logoOpacity.value = withDelay(300, withSpring(1, { damping: 14, stiffness: 100 }));
    logoTranslateY.value = withDelay(300, withSpring(0, { damping: 14, stiffness: 100 }));
    logoScale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 90 }));
  }, []);

  useEffect(() => {
    textOpacity.value = withDelay(600, withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    }));
    textTranslateY.value = withDelay(600, withTiming(0, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }));
    textLetterSpacing.value = withDelay(600, withTiming(10, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 800 }, (finished) => {
        if (finished) {
          runOnJS(onAnimationFinish)();
        }
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
    letterSpacing: textLetterSpacing.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.content}>
        <Animated.Image
          source={require("../assets/images/logo.png")}
          style={[styles.logo, logoStyle]}
          resizeMode="contain"
        />
        <Animated.Text style={[styles.title, textStyle]}>
          CAPSHION
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    gap: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: GlassTheme.neonPlatinum,
    textTransform: "uppercase",
  },
});
