import { BlurView } from "expo-blur";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GlassTheme } from "@/constants/LiquidGlass";
import { useAuth } from "@/hooks/useAuth";
import HapticButton from "./HapticButton";

export default function GlassHeader() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BlurView
        intensity={70}
        tint="systemThinMaterialLight"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        <View style={styles.brandRow}>
          <Ionicons name="sparkles" size={20} color={GlassTheme.neonPlatinum} />
          <Text style={styles.brandText}>Capshion</Text>
        </View>
        <View style={styles.actionsRow}>
          {user?.is_premium && (
            <HapticButton
              style={styles.crownBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <MaterialCommunityIcons name="crown" size={18} color="#D4AF37" />
            </HapticButton>
          )}
          <HapticButton
            style={styles.actionBtn}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Ionicons name="person-circle-outline" size={26} color={GlassTheme.neonPlatinum} />
          </HapticButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  inner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: "bold",
    color: GlassTheme.neonPlatinum,
    letterSpacing: -0.3,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  crownBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
