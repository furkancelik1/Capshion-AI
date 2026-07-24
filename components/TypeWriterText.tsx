import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { GlassTheme } from "@/constants/LiquidGlass";

interface TypeWriterTextProps {
  text: string;
  speed?: number;
}

export default function TypeWriterText({
  text,
  speed = 20,
}: TypeWriterTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [done, setDone] = useState(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    setDisplayedText("");
    setDone(false);

    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.15, { duration: 500 }), -1, true);
  }, []);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: done ? 0 : opacity.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Text style={styles.text}>
        {displayedText}
        {!done && (
          <Animated.Text style={[styles.cursor, cursorStyle]}>
            |
          </Animated.Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.neonPlatinum,
    lineHeight: 21,
    textShadowColor: "rgba(139, 92, 246, 0.4)",
    textShadowRadius: 8,
  },
  cursor: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8B5CF6",
    textShadowColor: "rgba(139, 92, 246, 0.6)",
    textShadowRadius: 10,
  },
});
