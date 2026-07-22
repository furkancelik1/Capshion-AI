import { Dimensions, StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { GlassTheme } from "@/constants/LiquidGlass";
import AmbientGlow from "@/components/AmbientGlow";
import GlassPanel from "@/components/GlassPanel";
import HapticButton from "@/components/HapticButton";

const { height, width } = Dimensions.get("window");

const PAGES = [
  {
    title: "CAPSHION'A HOŞ GELDİN",
    subtitle: "Sosyal medyanı yapay zeka ile yönet",
    icon: "sparkles" as const,
  },
  {
    title: "KUSURSUZ İÇERİKLER",
    subtitle:
      "Yapay zeka desteğiyle fotoğraflarına en uygun başlıkları, etiketleri ve açıklamaları saniyeler içinde oluştur.",
    icon: "bulb" as const,
  },
  {
    title: "TONUNU SEÇ, ÖNE ÇIK",
    subtitle:
      "Havalı, eğlenceli, minimalist veya profesyonel — markana ve tarzına en uygun tonu seç, fark yarat.",
    icon: "color-palette" as const,
  },
];

function PageDot({ index, scrollY }: { index: number; scrollY: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * height, index * height, (index + 1) * height];
    const opacity = interpolate(scrollY.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP);
    const scale = interpolate(scrollY.value, input, [0.8, 1.3, 0.8], Extrapolation.CLAMP);
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: GlassTheme.neonPlatinum,
        },
        style,
      ]}
    />
  );
}

function Section({
  index,
  scrollY,
  title,
  subtitle,
  icon,
}: {
  index: number;
  scrollY: SharedValue<number>;
  title: string;
  subtitle: string;
  icon: "sparkles" | "bulb" | "color-palette";
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * height, index * height, (index + 1) * height];
    const opacity = interpolate(scrollY.value, input, [0, 1, 0], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, input, [50, 0, -50], Extrapolation.CLAMP);
    const scale = interpolate(scrollY.value, input, [0.9, 1, 1.1], Extrapolation.CLAMP);
    return { opacity, transform: [{ translateY }, { scale }] };
  });

  return (
    <View style={styles.page}>
      {index === 0 ? (
        <Animated.View style={[styles.centerContent, animatedStyle]}>
          <Animated.Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.centerContent, animatedStyle]}>
          <GlassPanel style={styles.iconCard}>
            <Ionicons name={icon} size={40} color={GlassTheme.primary} />
          </GlassPanel>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Animated.View>
      )}
    </View>
  );
}

export default function OnboardingScreen() {
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        bounces={false}
      >
        {PAGES.map((page, i) => (
          <Section
            key={i}
            index={i}
            scrollY={scrollY}
            title={page.title}
            subtitle={page.subtitle}
            icon={page.icon}
          />
        ))}
        <View style={styles.page}>
          <Animated.View style={styles.centerContent}>
            <GlassPanel style={styles.lastCard}>
              <Ionicons name="rocket" size={44} color={GlassTheme.neonPlatinum} />
              <Text style={styles.lastTitle}>HAZIRSIN!</Text>
              <Text style={styles.lastSubtitle}>
                Yapay zeka destekli captions dünyasına adım atmaya ne dersin?
              </Text>
              <HapticButton
                style={styles.startButton}
                onPress={() => router.push("/(auth)/login")}
                activeOpacity={0.85}
              >
                <Text style={styles.startButtonText}>GİRİŞ YAP / BAŞLA</Text>
              </HapticButton>
            </GlassPanel>
          </Animated.View>
        </View>
      </Animated.ScrollView>

      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <PageDot key={i} index={i} scrollY={scrollY} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.background,
  },
  page: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  centerContent: {
    alignItems: "center",
    gap: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: GlassTheme.neonPlatinum,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  iconCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GlassTheme.border,
  },
  lastCard: {
    alignItems: "center",
    gap: 16,
    padding: 32,
    borderRadius: GlassTheme.radiusLg,
    borderWidth: 1,
    borderColor: GlassTheme.border,
  },
  lastTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: GlassTheme.neonPlatinum,
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  lastSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  startButton: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    backgroundColor: GlassTheme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  dots: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    alignSelf: "center",
    gap: 10,
  },
});
