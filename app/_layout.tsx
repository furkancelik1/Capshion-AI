import { useEffect } from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
// Hatalı olan @react-navigation/native importunu kaldırıp, temaları expo-router'dan alıyoruz:
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import Colors from "../constants/Colors";
import { useAuth } from "../hooks/useAuth";

function RootLayoutNav() {
  // Normalize ColorSchemeName to only 'light' | 'dark' so it can safely index Colors
  const rawScheme = useColorScheme();
  const colorScheme: "light" | "dark" =
    rawScheme === "light" ? "light" : "dark";
  const colors = Colors[colorScheme];
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Kullanıcının şu an (auth) grubu içinde olup olmadığını kontrol et
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      // Kullanıcı giriş yapmamışsa ve auth sayfalarında değilse giriş ekranına yönlendir
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Kullanıcı giriş yapmışsa ve hala login/register sayfalarındaysa ana sayfaya yönlendir
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  // İlk yükleme esnasında şık bir loading göstergesi sunalım
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Alt Menü (Tab) Yapısı */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* (auth) satırını sildik, Expo Router alt rotaları kendisi eşleştirecek */}

        {/* Sonuç Detay Ekranı */}
        <Stack.Screen
          name="caption/[id]"
          options={{
            presentation: "modal",
            title: "Capshion Detay",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <RootLayoutNav />;
}
