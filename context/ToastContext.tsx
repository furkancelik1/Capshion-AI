import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GlassTheme } from "@/constants/LiquidGlass";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: "checkmark-circle", color: "#34C759" },
  error: { icon: "alert-circle", color: "#FF3B30" },
  info: { icon: "information-circle", color: GlassTheme.primary },
};

function GlassToast({ message, type, onHide }: { message: string; type: ToastType; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });

    const timer = setTimeout(() => {
      translateY.value = withTiming(-120, { duration: 250 });
      opacity.value = withTiming(0, { duration: 200 });
      setTimeout(onHide, 300);
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const config = TOAST_CONFIG[type];

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + 12 },
        animatedStyle,
      ]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <Ionicons name={config.icon} size={20} color={config.color} />
        <Text style={styles.message}>{message}</Text>
      </BlurView>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [counter, setCounter] = useState(0);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    Haptics.notificationAsync(
      type === "error"
        ? Haptics.NotificationFeedbackType.Error
        : type === "info"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
    );
    setCounter((c) => c + 1);
    setToasts((prev) => [...prev, { id: counter + 1, message, type }]);
  }, [counter]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {toasts.map((toast) => (
          <GlassToast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onHide={() => removeToast(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 9999,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    maxWidth: "85%",
  },
  blur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.neonPlatinum,
    flexShrink: 1,
  },
});
