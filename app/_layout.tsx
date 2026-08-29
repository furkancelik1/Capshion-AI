import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { LogBox, Platform, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PostHogProvider } from "posthog-react-native";
import Purchases from "react-native-purchases";
import AnimatedBackground from "../components/AnimatedBackground";
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { initPromise } from "../i18n";
import {
  api, setLastNavigationTimestamp
} from "../services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs(["Failed to ready ui_config before getOfferings"]);

function installUnhandledRejectionGuard() {
  try {
    const proc = (globalThis as any).process as
      | { on?: (event: string, cb: (reason: unknown) => void) => void }
      | undefined;
    proc?.on?.("unhandledRejection", (reason) => {
      console.warn("[Capshion] Yakalanmamış Promise hatası göz ardı edildi:", reason);
    });
  } catch {
    // koruma kurulamazsa sessizce devam et
  }
}
installUnhandledRejectionGuard();

if (!__DEV__ && (globalThis as any).ErrorUtils) {
  const ErrorUtilsAny = (globalThis as any).ErrorUtils;
  const originalHandler = ErrorUtilsAny.getGlobalHandler?.();
  ErrorUtilsAny.setGlobalHandler((error: unknown, isFatal: boolean) => {
    console.error("[Capshion] Yakalanan JS hatası:", error);
    if (isFatal) {
      originalHandler?.(error, isFatal);
    }
  });
}

function RootLayoutNav() {
  const [i18nReady, setI18nReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  console.log("RootLayout: usePushNotifications tetiklendi...");
  const { expoPushToken } = usePushNotifications();
  console.log("RootLayout: Token Değeri:", expoPushToken);
  useColorScheme();
  const colorScheme: "light" | "dark" = "light";
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
          console.error(
            "PUSH_DEBUG: Token kaydedilemedi:",
            err instanceof Error ? err.message : err,
          );
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

    const inAuthGroup =
      segments[0] === "(auth)" || (segments[0] as string) === "(public)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [splashDone, user, loading, segments, i18nReady]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      async (r) => {
        const data = r.notification.request.content.data as
          | Record<string, any>
          | undefined;
      if (data?.post_id) {
        setLastNavigationTimestamp(Date.now());
        await new Promise(resolve => setTimeout(resolve, 800));
        router.push(`/caption/${data.post_id}`);
      } else if (data?.screen === "history") {
        setLastNavigationTimestamp(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 800));
        router.push("/(tabs)/history");
      }
      },
    );
    return () => sub.remove();
  }, [router]);

  const inAuth =
    segments[0] === "(auth)" || (segments[0] as string) === "(public)";

  const customTheme = {
    ...(colorScheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorScheme === "dark" ? DarkTheme : DefaultTheme).colors,
      background: "transparent",
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F2F2F7" }}>
      <AnimatedBackground />
      {!splashDone ? (
        <AnimatedSplashScreen onAnimationFinish={() => setSplashDone(true)} />
      ) : (
        <>
          <ThemeProvider value={customTheme}>
            <Stack
              screenOptions={{
                animation: "slide_from_right",
                contentStyle: { backgroundColor: "transparent" },
              }}
            >
              <Stack.Screen
                name="(public)/onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(auth)/login"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(auth)/register"
                options={{ headerShown: false }}
              />
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
          <StatusBar style="dark" />
        </>
      )}
    </View>
  );
}

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;

export default function RootLayout() {
  useEffect(() => {
    const rcApiKey =
      Platform.OS === "ios"
        ? process.env.EXPO_PUBLIC_RC_APPLE_KEY
        : process.env.EXPO_PUBLIC_RC_GOOGLE_KEY;

    if (rcApiKey) {
      try {
        Purchases.configure({ apiKey: rcApiKey });
      } catch (err: unknown) {
        console.error(
          "[RevenueCat] Yapılandırma hatası:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PostHogProvider
        apiKey={"phc_ya4kkZMmmNMtDNNSHw2vtK38rifmwNThUEzJ8qNC4QwZ"}
        debug={true}
        options={{
          host: "https://eu.i.posthog.com",
          flushAt: 1,
          disabled: false,
        }}
      >
        <BottomSheetModalProvider>
          <ToastProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </ToastProvider>
        </BottomSheetModalProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}
