import AILoadingOverlay from "@/components/AILoadingOverlay";
import HapticButton from "@/components/HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";
import { useToast } from "@/context/ToastContext";
import { safeReadBase64 } from "@/hooks/useGenerateCaption";
import {
  api,
  ApiError,
  HookLabFeedbackAction,
  HookLabPlatform,
  HookLabSession,
  HookLabVariant,
} from "@/services/api";
import { logAppEvent } from "@/utils/analytics";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import i18next from "i18next";
import { usePostHog } from "posthog-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  FadeIn,
  FadeInUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const PLATFORMS: { id: HookLabPlatform; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "instagram", icon: "logo-instagram" },
  { id: "tiktok", icon: "logo-tiktok" },
  { id: "linkedin", icon: "logo-linkedin" },
  { id: "x", icon: "logo-twitter" },
  { id: "threads", icon: "at" },
];

type Phase = "setup" | "swipe" | "done";
type UnlockedVariant = Extract<HookLabVariant, { locked: false }>;

function fullText(v: UnlockedVariant) {
  const tags = (v.hashtags ?? []).join(" ");
  return tags ? `${v.caption_text}\n\n${tags}` : v.caption_text;
}

// ─── Tek kart ────────────────────────────────────────────────────────────────
function HookCard({ variant, onUnlock }: { variant: HookLabVariant; onUnlock: () => void }) {
  const { t } = useTranslation();
  const styleLabel = t(`hookLab.styles.${variant.style}`);

  if (variant.locked) {
    return (
      <View style={styles.card}>
        <Text style={styles.styleChip}>{styleLabel}</Text>
        <Text style={styles.hookText}>{variant.hook_preview}</Text>
        <View style={styles.lockedBody}>
          {/* Sahte satırlar: gerçek metin istemciye hiç gelmez */}
          {[0.95, 0.8, 0.9, 0.6].map((w, i) => (
            <View key={i} style={[styles.fakeLine, { width: `${w * 100}%` }]} />
          ))}
          <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        </View>
        <Pressable style={styles.unlockBtn} onPress={onUnlock}>
          <Ionicons name="diamond" size={16} color="#fff" />
          <Text style={styles.unlockText}>{t("hookLab.unlock")}</Text>
        </Pressable>
      </View>
    );
  }

  const body = variant.caption_text.split("\n").slice(1).join("\n").trim();
  const isShortHook = variant.hook.length <= 48;

  return (
    <View style={styles.card}>
      <Text style={styles.styleChip}>{styleLabel}</Text>
      {/* Kısa metinler kartın ortasında durur, uzunlar üstten başlayıp kayar */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.hookText, styles.hookInBody, isShortHook && styles.hookTextLarge]}>{variant.hook}</Text>
        {body ? <Text style={styles.bodyText}>{body}</Text> : null}
      </ScrollView>
      {variant.hashtags?.length ? (
        <View style={styles.hashtagFooter}>
          <Text style={styles.hashtags}>{variant.hashtags.join(" ")}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Kaydırılabilir üst kart ────────────────────────────────────────────────
function SwipeableCard({
  variant,
  onSwiped,
  onUnlock,
  swipeRef,
}: {
  variant: HookLabVariant;
  onSwiped: (dir: "left" | "right") => void;
  onUnlock: () => void;
  swipeRef: React.MutableRefObject<((dir: "left" | "right") => void) | null>;
}) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const threshold = width * 0.28;

  const fling = useCallback(
    (dir: "left" | "right") => {
      x.value = withTiming(dir === "right" ? width * 1.5 : -width * 1.5, { duration: 220 }, (finished) => {
        if (finished) runOnJS(onSwiped)(dir);
      });
    },
    [onSwiped, width, x],
  );
  swipeRef.current = fling;

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > threshold || Math.abs(e.velocityX) > 900) {
        const dir = e.translationX > 0 ? "right" : "left";
        x.value = withTiming(dir === "right" ? width * 1.5 : -width * 1.5, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onSwiped)(dir);
        });
      } else {
        x.value = withSpring(0, { damping: 15 });
        y.value = withSpring(0, { damping: 15 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-12, 0, 12])}deg` },
    ],
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, threshold], [0, 1], "clamp") }));
  const skipStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-threshold, 0], [1, 0], "clamp") }));

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[StyleSheet.absoluteFill, cardStyle]}>
        <HookCard variant={variant} onUnlock={onUnlock} />
        <Reanimated.View style={[styles.stamp, styles.stampLike, likeStyle]} pointerEvents="none">
          <Ionicons name="heart" size={28} color={GlassTheme.primary} />
        </Reanimated.View>
        <Reanimated.View style={[styles.stamp, styles.stampSkip, skipStyle]} pointerEvents="none">
          <Ionicons name="close" size={28} color={GlassTheme.dangerText} />
        </Reanimated.View>
      </Reanimated.View>
    </GestureDetector>
  );
}

// ─── Ekran ──────────────────────────────────────────────────────────────────
export default function HookLabScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const posthog = usePostHog();
  const params = useLocalSearchParams<{ images?: string; tone?: string; gender?: string; ageRange?: string }>();

  const images = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(params.images || "[]");
      return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
    } catch {
      return [];
    }
  }, [params.images]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [platform, setPlatform] = useState<HookLabPlatform>("instagram");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<HookLabSession | null>(null);
  const [cursor, setCursor] = useState(0);
  const [liked, setLiked] = useState<number[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const swipeRef = useRef<((dir: "left" | "right") => void) | null>(null);
  const wentToPaywall = useRef(false);

  const sendFeedback = useCallback(
    (index: number, action: HookLabFeedbackAction) => {
      if (!session) return;
      api.hookLabFeedback(session.session_id, index, action).catch(() => {});
    },
    [session],
  );

  // Paywall'dan dönünce: Premium olduysa kilitler sunucuda açılır.
  useFocusEffect(
    useCallback(() => {
      if (!wentToPaywall.current || !session) return;
      wentToPaywall.current = false;
      api
        .hookLabGetSession(session.session_id)
        .then((fresh) => {
          setSession(fresh);
          if (fresh.is_premium) {
            showToast?.(t("hookLab.unlockedToast"), "success");
            posthog?.capture("hook_lab_unlocked_after_purchase");
          }
        })
        .catch(() => {});
    }, [session, posthog, showToast, t]),
  );

  const openPaywall = useCallback(
    (source: string) => {
      posthog?.capture("hook_lab_paywall_view", { source });
      logAppEvent("hook_lab_paywall_view", { source });
      wentToPaywall.current = true;
      router.push("/paywall");
    },
    [posthog],
  );

  const handleGenerate = async () => {
    if (loading) return;
    if (images.length === 0) {
      Alert.alert(t("home.alertMissingTitle"), t("hookLab.noImage"));
      return;
    }
    setLoading(true);
    try {
      const base64 = (await Promise.all(images.map((u) => safeReadBase64(u, showToast)))).filter(
        (r): r is string => r !== null,
      );
      if (!base64.length) throw new Error(t("hookLab.noImage"));

      const result = await api.hookLabGenerate({
        images: base64,
        platform,
        tone: String(params.tone || "neutral"),
        gender: String(params.gender || "female"),
        ageRange: String(params.ageRange || ""),
        language: i18next.language,
      });
      setSession(result);
      setCursor(0);
      setLiked([]);
      setPhase("swipe");
      posthog?.capture("hook_lab_generated", { platform, unlocked: result.unlocked_count });
      logAppEvent("hook_lab_generated", { platform });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        Alert.alert(t("hookLab.outOfCreditsTitle"), t("hookLab.outOfCreditsBody"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("hookLab.goPremium"), onPress: () => openPaywall("out_of_credits") },
        ]);
      } else {
        showToast?.(err instanceof Error ? err.message : t("hookLab.error"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const variants = session?.variants ?? [];
  const current = variants[cursor];

  const onSwiped = useCallback(
    (dir: "left" | "right") => {
      const v = variants[cursor];
      if (!v) return;
      Haptics.selectionAsync();
      if (v.locked) {
        posthog?.capture("hook_lab_swipe", { dir, style: v.style, locked: true });
        if (dir === "right") {
          // Kilitli karta "beğen" → anında paywall (en güçlü tetikleyici)
          openPaywall("locked_swipe_right");
        }
      } else {
        sendFeedback(v.index, dir === "right" ? "like" : "skip");
        posthog?.capture("hook_lab_swipe", { dir, style: v.style, locked: false });
        if (dir === "right") setLiked((prev) => [...prev, v.index]);
      }
      const next = cursor + 1;
      setCursor(next);
      if (next >= variants.length) setPhase("done");
    },
    [cursor, variants, sendFeedback, posthog, openPaywall],
  );

  const handleCopy = async (v: UnlockedVariant) => {
    try {
      await Clipboard.setStringAsync(fullText(v));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopiedIndex(v.index);
      sendFeedback(v.index, "copy");
      posthog?.capture("hook_lab_copy", { style: v.style, platform: session?.platform ?? platform });
      logAppEvent("hook_lab_copy", { style: v.style });
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      Alert.alert(t("home.alertError"), t("common.alertClipboardError"));
    }
  };

  const restartSwipe = () => {
    setCursor(0);
    setLiked([]);
    setPhase("swipe");
  };

  // ── Sonuç listesi: önce beğenilenler, sonra diğer açıklar, en sonda kilitliler
  const doneList = useMemo(() => {
    const unlocked = variants.filter((v): v is UnlockedVariant => !v.locked);
    const likedSet = new Set(liked);
    const first = unlocked.filter((v) => likedSet.has(v.index));
    const rest = unlocked.filter((v) => !likedSet.has(v.index));
    return { picks: first.length ? first : unlocked, others: first.length ? rest : [], lockedCount: variants.length - unlocked.length };
  }, [variants, liked]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={GlassTheme.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("hookLab.title")}</Text>
        <View style={styles.headerBtn}>
          {phase === "swipe" ? (
            <Text style={styles.counter}>
              {Math.min(cursor + 1, variants.length)}/{variants.length}
            </Text>
          ) : null}
        </View>
      </View>

      {phase === "setup" && (
        <ScrollView contentContainerStyle={styles.setup}>
          <Reanimated.View entering={FadeInUp.springify().damping(14)}>
            <Text style={styles.setupTitle}>{t("hookLab.setupTitle")}</Text>
            <Text style={styles.setupSub}>{t("hookLab.setupSub")}</Text>
          </Reanimated.View>

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {images.map((uri) => (
                <ExpoImage key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
              ))}
            </ScrollView>
          )}

          <Text style={styles.sectionLabel}>{t("hookLab.platformLabel")}</Text>
          <View style={styles.chips}>
            {PLATFORMS.map((p) => {
              const active = p.id === platform;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPlatform(p.id);
                  }}
                >
                  <Ionicons name={p.icon} size={16} color={active ? "#fff" : GlassTheme.textMain} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`hookLab.platforms.${p.id}`)}</Text>
                </Pressable>
              );
            })}
          </View>

          <HapticButton style={[styles.primaryBtn, loading && { opacity: 0.6 }]} onPress={handleGenerate} disabled={loading}>
            <Text style={styles.primaryBtnText}>{t("hookLab.generate")}</Text>
          </HapticButton>
          <Text style={styles.costNote}>{t("hookLab.costNote")}</Text>
        </ScrollView>
      )}

      {phase === "swipe" && current && (
        <View style={styles.swipeArea}>
          <Text style={styles.swipeHint}>{t("hookLab.swipeHint")}</Text>
          <View style={styles.deck}>
            {variants[cursor + 1] && (
              <View style={[StyleSheet.absoluteFill, styles.nextCard]} pointerEvents="none">
                <HookCard variant={variants[cursor + 1]} onUnlock={() => {}} />
              </View>
            )}
            <SwipeableCard
              key={`${session?.session_id}-${cursor}`}
              variant={current}
              onSwiped={onSwiped}
              onUnlock={() => openPaywall("locked_card_button")}
              swipeRef={swipeRef}
            />
          </View>
          <View style={styles.actions}>
            <Pressable style={[styles.roundBtn, styles.roundSkip]} onPress={() => swipeRef.current?.("left")}>
              <Ionicons name="close" size={30} color={GlassTheme.dangerText} />
            </Pressable>
            <Pressable style={[styles.roundBtn, styles.roundLike]} onPress={() => swipeRef.current?.("right")}>
              <Ionicons name="heart" size={30} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {phase === "done" && (
        <ScrollView contentContainerStyle={styles.done}>
          <Reanimated.Text entering={FadeIn} style={styles.setupTitle}>
            {liked.length ? t("hookLab.doneTitle") : t("hookLab.doneTitleNone")}
          </Reanimated.Text>

          {doneList.picks.map((v, i) => (
            <Reanimated.View key={v.index} entering={FadeInUp.delay(i * 100).springify().damping(14)} style={styles.resultCard}>
              <Text style={styles.styleChip}>{t(`hookLab.styles.${v.style}`)}</Text>
              <Text style={styles.resultText}>{v.caption_text}</Text>
              {v.hashtags?.length ? <Text style={styles.hashtags}>{v.hashtags.join(" ")}</Text> : null}
              <Pressable style={styles.copyBtn} onPress={() => handleCopy(v)}>
                <Text style={styles.copyBtnText}>{copiedIndex === v.index ? t("common.copied") : t("common.copyLabel")}</Text>
              </Pressable>
            </Reanimated.View>
          ))}

          {doneList.others.map((v) => (
            <View key={v.index} style={[styles.resultCard, styles.resultCardMuted]}>
              <Text style={styles.styleChip}>{t(`hookLab.styles.${v.style}`)}</Text>
              <Text style={styles.resultText} numberOfLines={3}>{v.caption_text}</Text>
              <Pressable style={styles.copyBtnGhost} onPress={() => handleCopy(v)}>
                <Text style={styles.copyBtnGhostText}>{copiedIndex === v.index ? t("common.copied") : t("common.copyLabel")}</Text>
              </Pressable>
            </View>
          ))}

          {doneList.lockedCount > 0 && (
            <Pressable style={styles.upsell} onPress={() => openPaywall("done_upsell")}>
              <Ionicons name="diamond" size={22} color={GlassTheme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.upsellTitle}>{t("hookLab.upsellTitle", { count: doneList.lockedCount })}</Text>
                <Text style={styles.upsellSub}>{t("hookLab.upsellSub")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={GlassTheme.textMuted} />
            </Pressable>
          )}

          <Pressable style={styles.secondaryBtn} onPress={restartSwipe}>
            <Text style={styles.secondaryBtnText}>{t("hookLab.again")}</Text>
          </Pressable>
        </ScrollView>
      )}

      <AILoadingOverlay visible={loading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GlassTheme.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 52 },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: GlassTheme.textMain },
  counter: { fontSize: 14, fontWeight: "600", color: GlassTheme.textMuted },

  setup: { padding: 20, gap: 16 },
  setupTitle: { fontSize: 26, fontWeight: "800", color: GlassTheme.textMain, letterSpacing: -0.5 },
  setupSub: { fontSize: 15, color: GlassTheme.textMuted, marginTop: 6, lineHeight: 21 },
  thumbRow: { flexGrow: 0 },
  thumb: { width: 72, height: 72, borderRadius: GlassTheme.radiusSm, marginRight: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: GlassTheme.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: GlassTheme.radiusPill, backgroundColor: GlassTheme.panel, borderWidth: 1, borderColor: GlassTheme.border,
  },
  chipActive: { backgroundColor: GlassTheme.textMain, borderColor: GlassTheme.textMain },
  chipText: { fontSize: 14, fontWeight: "600", color: GlassTheme.textMain },
  chipTextActive: { color: "#fff" },
  primaryBtn: { backgroundColor: GlassTheme.primaryButtonBg, borderRadius: GlassTheme.radiusPill, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: GlassTheme.primaryButtonText, fontSize: 16, fontWeight: "700" },
  costNote: { textAlign: "center", fontSize: 12, color: GlassTheme.textMuted },

  swipeArea: { flex: 1, paddingHorizontal: 20, paddingBottom: 12 },
  swipeHint: { textAlign: "center", color: GlassTheme.textMuted, fontSize: 13, marginBottom: 12 },
  deck: { flex: 1 },
  nextCard: { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 0.7 },
  card: {
    flex: 1, backgroundColor: GlassTheme.panel, borderRadius: 24, padding: 22,
    borderWidth: 1, borderColor: GlassTheme.border, ...GlassTheme.cardShadow,
  },
  styleChip: {
    alignSelf: "flex-start", fontSize: 12, fontWeight: "700", color: GlassTheme.primary,
    backgroundColor: "rgba(52,199,89,0.1)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: GlassTheme.radiusPill, overflow: "hidden",
  },
  hookText: { fontSize: 24, fontWeight: "800", color: GlassTheme.textMain, marginTop: 16, lineHeight: 31, letterSpacing: -0.3 },
  hookInBody: { marginTop: 0 },
  hookTextLarge: { fontSize: 30, lineHeight: 37, letterSpacing: -0.6 },
  bodyScroll: { flex: 1, marginTop: 4 },
  bodyContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 12, gap: 14 },
  bodyText: { fontSize: 17, color: GlassTheme.textMain, lineHeight: 25, opacity: 0.8 },
  hashtagFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: GlassTheme.border, paddingTop: 14, marginTop: 4 },
  hashtags: { fontSize: 14, color: "#007AFF", lineHeight: 20 },
  lockedBody: { marginTop: 18, gap: 10, overflow: "hidden", borderRadius: 8, paddingVertical: 4 },
  fakeLine: { height: 14, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.08)" },
  unlockBtn: {
    marginTop: "auto", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GlassTheme.textMain, borderRadius: GlassTheme.radiusPill, paddingVertical: 14,
  },
  unlockText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  stamp: { position: "absolute", top: 24, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", ...GlassTheme.cardShadow },
  stampLike: { left: 24 },
  stampSkip: { right: 24 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 28, paddingTop: 20 },
  roundBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", ...GlassTheme.cardShadow },
  roundSkip: { backgroundColor: "#fff" },
  roundLike: { backgroundColor: GlassTheme.primary },

  done: { padding: 20, gap: 14 },
  resultCard: { backgroundColor: GlassTheme.panel, borderRadius: GlassTheme.radiusLg, padding: 18, borderWidth: 1, borderColor: GlassTheme.border, gap: 10 },
  resultCardMuted: { opacity: 0.85 },
  resultText: { fontSize: 15, color: GlassTheme.textMain, lineHeight: 22 },
  copyBtn: { backgroundColor: GlassTheme.primaryButtonBg, borderRadius: GlassTheme.radiusPill, paddingVertical: 12, alignItems: "center" },
  copyBtnText: { color: "#fff", fontWeight: "700" },
  copyBtnGhost: { borderRadius: GlassTheme.radiusPill, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: GlassTheme.border },
  copyBtnGhostText: { color: GlassTheme.textMain, fontWeight: "600" },
  upsell: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: GlassTheme.radiusLg,
    backgroundColor: "rgba(52,199,89,0.08)", borderWidth: 1, borderColor: GlassTheme.selectedBorder,
  },
  upsellTitle: { fontSize: 15, fontWeight: "700", color: GlassTheme.textMain },
  upsellSub: { fontSize: 13, color: GlassTheme.textMuted, marginTop: 2 },
  secondaryBtn: { paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: GlassTheme.textMuted, fontWeight: "600", fontSize: 15 },
});
