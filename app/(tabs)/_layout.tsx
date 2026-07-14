import { Ionicons } from "@expo/vector-icons"; // Expo ile dahili gelen ikon kütüphanesi
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import Colors from "../../constants/Colors";
export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "dark";
  const activeColor = Colors[colorScheme as "light" | "dark"].tint;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme as "light" | "dark"].background,
          borderTopColor: Colors[colorScheme as "light" | "dark"].border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerStyle: {
          backgroundColor: Colors[colorScheme as "light" | "dark"].background,
        },
        headerShadowVisible: false,
        headerTintColor: Colors[colorScheme as "light" | "dark"].text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Oluştur",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "camera" : "camera-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Geçmiş",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "archive" : "archive-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
