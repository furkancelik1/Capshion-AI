import { GlassTheme } from "@/constants/LiquidGlass";
import { StyleSheet, View, ViewStyle } from "react-native";

export default function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: GlassTheme.panel,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    borderRadius: GlassTheme.radiusMd,
    overflow: "hidden",
  },
});
