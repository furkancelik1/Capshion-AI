import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const { width, height } = Dimensions.get("window");

interface DriftCircleProps {
  size: number;
  color: string;
  initialX: number;
  initialY: number;
  driftX: number;
  driftY: number;
  duration: number;
  scaleRange?: [number, number];
}

function DriftCircle({
  size,
  color,
  initialX,
  initialY,
  driftX,
  driftY,
  duration,
  scaleRange = [1, 1.15],
}: DriftCircleProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(scaleRange[0]);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(driftX, { duration }),
      -1,
      true,
    );
    translateY.value = withRepeat(
      withTiming(driftY, { duration }),
      -1,
      true,
    );
    scale.value = withRepeat(
      withTiming(scaleRange[1], { duration: duration * 0.7 }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: initialX + translateX.value },
      { translateY: initialY + translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function AnimatedBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <DriftCircle
        size={380}
        color="rgba(10,132,255,0.35)"
        initialX={width * -0.15}
        initialY={height * -0.1}
        driftX={width * 0.35}
        driftY={height * 0.3}
        duration={18000}
        scaleRange={[1, 1.2]}
      />
      <DriftCircle
        size={320}
        color="rgba(100,210,255,0.3)"
        initialX={width * 0.6}
        initialY={height * 0.5}
        driftX={width * 0.3}
        driftY={height * 0.35}
        duration={22000}
        scaleRange={[1, 1.15]}
      />
      <DriftCircle
        size={260}
        color="rgba(226,232,240,0.25)"
        initialX={width * 0.75}
        initialY={height * 0.85}
        driftX={width * -0.4}
        driftY={height * -0.2}
        duration={20000}
        scaleRange={[1, 1.25]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0A0A0F",
  },
  circle: {
    position: "absolute",
  },
});
