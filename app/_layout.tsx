import { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GlassTheme } from "../constants/LiquidGlass";
import AmbientGlow from "../components/AmbientGlow";
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

    const inAuthGroup = segments[0] === "(auth)" || (segments[0] as string) === "(public)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, i18nReady]);

  if (loading || !i18nReady) {
    return <AnimatedSplash />;
  }

  const inAuth = segments[0] === "(auth)" || (segments[0] as string) === "(public)";

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
        <Stack screenOptions={{ animation: 'slide_from_right' }}>
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
    </View>
  );
}

function AnimatedSplash() {
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(-50);
  const logoScale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(50);
  const textLetterSpacing = useSharedValue(3);

  useEffect(() => {
    logoOpacity.value = withDelay(500, withSpring(1, { damping: 14, stiffness: 100 }));
    logoTranslateY.value = withDelay(500, withSpring(0, { damping: 14, stiffness: 100 }));
    logoScale.value = withDelay(500, withSpring(1, { damping: 12, stiffness: 90 }));
  }, []);

  useEffect(() => {
    textOpacity.value = withDelay(800, withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }));
    textTranslateY.value = withDelay(800, withTiming(0, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    }));
    textLetterSpacing.value = withDelay(800, withTiming(10, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value },
      { scale: logoScale.value },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
    letterSpacing: textLetterSpacing.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: GlassTheme.background }}>
      <AmbientGlow />
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Animated.Image
          source={require("../assets/images/logo.png")}
          style={[{ width: 100, height: 100 }, logoStyle]}
          resizeMode="contain"
        />
        <Animated.Text
          style={[
            {
              fontSize: 28,
              fontWeight: "800",
              color: GlassTheme.neonPlatinum,
              textTransform: "uppercase",
            },
            textStyle,
          ]}
        >
          CAPSHION
        </Animated.Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
