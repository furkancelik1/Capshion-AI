import { BlurView } from "expo-blur";
import { GlassTheme } from "@/constants/LiquidGlass";
import { StyleSheet, ViewStyle } from "react-native";

export default function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <BlurView
      intensity={50}
      tint="systemThinMaterialDark"
      style={[styles.panel, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: GlassTheme.glassBorder,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: GlassTheme.glassCardBg,
  },
});
