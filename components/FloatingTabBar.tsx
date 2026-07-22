import { BlurView } from "expo-blur";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import HapticButton from "./HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";

interface TabRoute {
  key: string;
  name: string;
}

interface FloatingTabBarProps {
  state: {
    index: number;
    routes: TabRoute[];
  };
  navigation: any;
}

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "camera",
  history: "archive",
  profile: "person",
};

const TAB_I18N: Record<string, string> = {
  index: "tabs.create",
  history: "tabs.history",
  profile: "tabs.profile",
};

export default function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <BlurView
        intensity={80}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        {state.routes.map((route: TabRoute, index: number) => {
          const isFocused = state.index === index;
          const icon = TAB_ICONS[route.name];
          const labelKey = TAB_I18N[route.name];

          if (!icon || !labelKey) return null;

          const iconName = (isFocused ? icon : (`${icon}-outline`)) as keyof typeof Ionicons.glyphMap;

          return (
            <HapticButton
              key={route.key}
              style={styles.tabItem}
              onPress={() => navigation.navigate(route.name)}
            >
              <View
                style={[
                  styles.iconWrap,
                  isFocused && styles.iconWrapActive,
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={22}
                  color={isFocused ? GlassTheme.primary : GlassTheme.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? GlassTheme.neonPlatinum : GlassTheme.textMuted },
                ]}
              >
                {t(labelKey)}
              </Text>
            </HapticButton>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  inner: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
