import { useEffect, useState } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GlassTheme } from "../constants/LiquidGlass";
import { useAuth, AuthProvider } from "../hooks/useAuth";
import i18next, { initPromise } from "../i18n";

function RootLayoutNav() {
  const [i18nReady, setI18nReady] = useState(false);
  const rawScheme = useColorScheme();
  const colorScheme: "light" | "dark" =
    rawScheme === "light" ? "light" : "dark";
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initPromise.then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (loading || !i18nReady) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, i18nReady]);

  if (loading || !i18nReady) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={[...GlassTheme.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={GlassTheme.textMain} />
        </View>
      </View>
    );
  }

  const inAuth = segments[0] === "(auth)";

  return (
    <View style={{ flex: 1, backgroundColor: GlassTheme.background }}>
      {!inAuth && (
        <LinearGradient
          colors={[...GlassTheme.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="caption/[id]"
            options={{
              headerShown: false,
              presentation: "modal",
            }}
          />
        </Stack>
      </ThemeProvider>
      <StatusBar style="light" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
