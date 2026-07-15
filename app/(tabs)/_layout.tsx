import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassTheme } from "../../constants/LiquidGlass";
import { TopTabs } from "expo-router/js-top-tabs";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <TopTabs
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
      }}
      tabBar={(props: any) => (
        <View
          style={[styles.tabBarContainer, { paddingBottom: insets.bottom }]}
        >
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.tabBarContent}>
            {props.state.routes.map((route: any, index: number) => {
              const isFocused = props.state.index === index;
              const color = isFocused
                ? GlassTheme.textMain
                : GlassTheme.textMuted;

              let iconName = "camera-outline";
              let label = "Oluştur";

              if (route.name === "index") {
                iconName = isFocused ? "camera" : "camera-outline";
                label = "Oluştur";
              } else if (route.name === "history") {
                iconName = isFocused ? "archive" : "archive-outline";
                label = "Geçmiş";
              } else if (route.name === "profile") {
                iconName = isFocused ? "person" : "person-outline";
                label = "Profil";
              }

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={() => props.navigation.navigate(route.name)}
                  style={styles.tabItem}
                >
                  <Ionicons name={iconName as any} size={24} color={color} />
                  <Text style={[styles.tabLabel, { color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="history" />
      <TopTabs.Screen name="profile" />
    </TopTabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    height: 60 + 20,
  },
  tabBarContent: {
    flexDirection: "row",
    height: 60,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: "500",
  },
});
