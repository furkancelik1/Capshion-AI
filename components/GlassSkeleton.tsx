import { useEffect, useRef } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

interface GlassSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function GlassSkeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}: GlassSkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900 }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function HistoryCardSkeleton() {
  return (
    <Animated.View style={styles.cardWrap}>
      <View style={styles.cardRow}>
        <GlassSkeleton width={48} height={48} borderRadius={24} />
        <View style={styles.cardCol}>
          <GlassSkeleton width="70%" height={16} borderRadius={8} />
          <GlassSkeleton
            width="40%"
            height={14}
            borderRadius={8}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
      <GlassSkeleton
        width="100%"
        height={12}
        borderRadius={6}
        style={{ marginTop: 10 }}
      />
      <View style={styles.chipRow}>
        <GlassSkeleton width={60} height={22} borderRadius={999} />
        <GlassSkeleton width={80} height={22} borderRadius={999} />
        <GlassSkeleton width={50} height={22} borderRadius={999} />
      </View>
      <GlassSkeleton width="30%" height={11} borderRadius={6} style={{ marginTop: 8 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#E5E5EA",
  },
  cardWrap: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardCol: {
    flex: 1,
    gap: 4,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
});
