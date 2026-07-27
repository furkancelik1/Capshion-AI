import { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { usePushNotifications } from "../hooks/usePushNotifications";
import AnimatedBackground from "../components/AnimatedBackground";
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";
import { useAuth, AuthProvider } from "../hooks/useAuth";
import { api } from "../services/api";
import { ToastProvider } from "../context/ToastContext";
import i18next, { initPromise } from "../i18n";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const [i18nReady, setI18nReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  console.log("RootLayout: usePushNotifications tetiklendi...");
  const { expoPushToken } = usePushNotifications();
  console.log("RootLayout: Token Değeri:", expoPushToken);
  const rawScheme = useColorScheme();
  const colorScheme: "light" | "dark" =
    rawScheme === "light" ? "light" : "dark";
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (expoPushToken) {
      console.log("Expo Push Token:", expoPushToken);
    }
  }, [expoPushToken]);

  useEffect(() => {
    const saveTokenToDatabase = async () => {
      if (user?.email && expoPushToken) {
        try {
          await api.savePushToken(expoPushToken);
          console.log("PUSH_DEBUG: Token API ile başarıyla kaydedildi!");
        } catch (err) {
          console.error("PUSH_DEBUG: Token kaydedilemedi:", err instanceof Error ? err.message : err);
        }
      }
    };

    saveTokenToDatabase();
  }, [user, expoPushToken]);

  useEffect(() => {
    initPromise.then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (loading || !i18nReady) return;
    SplashScreen.hideAsync();
  }, [loading, i18nReady]);

  useEffect(() => {
    if (!splashDone || loading || !i18nReady) return;

    const inAuthGroup = segments[0] === "(auth)" || (segments[0] as string) === "(public)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [splashDone, user, loading, segments, i18nReady]);

  const inAuth = segments[0] === "(auth)" || (segments[0] as string) === "(public)";

  const customTheme = {
    ...(colorScheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorScheme === "dark" ? DarkTheme : DefaultTheme).colors,
      background: 'transparent',
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#05050A' }}>
      <AnimatedBackground />
      {!splashDone ? (
        <AnimatedSplashScreen onAnimationFinish={() => setSplashDone(true)} />
      ) : (
        <>
          <ThemeProvider value={customTheme}>
            <Stack screenOptions={{ animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}>
              <Stack.Screen name="(public)/onboarding" options={{ headerShown: false }} />
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
        </>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ToastProvider>
          <StripeProvider publishableKey="pk_test_51Tx5gVIdWpTyLlw8RFhrsFNpzbKPzLzLFfP0h56w9wgcpTZzWjfimyoHzK253wN6UYBl1dYB9eS6D4cFemHvUe7G00a1eJrPlg">
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </StripeProvider>
        </ToastProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
