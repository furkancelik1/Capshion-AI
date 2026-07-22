import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { GlassTheme } from "@/constants/LiquidGlass";

interface GlassEmptyStateProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  buttonText: string;
  onPress: () => void;
}

export default function GlassEmptyState({
  iconName,
  title,
  description,
  buttonText,
  onPress,
}: GlassEmptyStateProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.94, { damping: 10, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 8, stiffness: 150 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={50} tint="dark" style={styles.card}>
        <Ionicons name={iconName} size={64} color="rgba(255,255,255,0.2)" />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <Animated.View style={animatedStyle}>
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.button}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>{buttonText}</Text>
          </Pressable>
        </Animated.View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    alignItems: "center",
    padding: 32,
    borderRadius: 32,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    width: "100%",
    maxWidth: 340,
  },
  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "bold",
    color: GlassTheme.neonPlatinum,
    textAlign: "center",
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8B5CF6",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
