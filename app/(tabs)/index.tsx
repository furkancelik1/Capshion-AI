import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router, useRootNavigationState } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Animated,
  AppState,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  AppStateStatus,
} from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import AmbientGlow from "../../components/AmbientGlow";
import CameraWidget from "../../components/CameraWidget";
import AILoadingOverlay from "../../components/AILoadingOverlay";
import GlassBottomSheet from "../../components/GlassBottomSheet";
import {
  FeedIcon,
  HashtagIcon,
  SparkleIcon,
  ToneIcon,
} from "../../components/GlassIcons";
import GlassPanel from "../../components/GlassPanel";
import HapticButton from "../../components/HapticButton";
import HowItWorksModal from "../../components/HowItWorksModal";
import OutOfCreditsModal from "../../components/OutOfCreditsModal";
import PaymentWebViewModal from "../../components/PaymentWebViewModal";
import ToneSelector from "../../components/ToneSelector";
import { GlassTheme } from "../../constants/LiquidGlass";
import { useAuth } from "../../hooks/useAuth";
import { useGenerateCaption } from "../../hooks/useGenerateCaption";
import { usePayment } from "../../hooks/usePayment";
import { useStripePayment } from "../../hooks/useStripePayment";
import { api, lastNavigationTimestamp } from "../../services/api";
import { useToast } from "../../context/ToastContext";

function renderFeatureIcon(icon: string) {
  switch (icon) {
    case "tone":
      return <ToneIcon size={20} />;
    case "hashtag":
      return <HashtagIcon size={20} />;
    case "feed":
      return <FeedIcon size={20} />;
    default:
      return <SparkleIcon size={20} />;
  }
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.pulseDot, { opacity }]} />;
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();

  const STATS_DATA = [
    { value: "12K+", label: t("home.statsContent") },
    { value: "%94", label: t("home.statsEngagement") },
    { value: "3 sn", label: t("home.statsDuration") },
  ] as const;

  const FEATURES_DATA = [
    {
      icon: "tone" as const,
      title: t("home.featuresTone"),
      text: t("home.featuresToneDesc"),
    },
    {
      icon: "hashtag" as const,
      title: t("home.featuresHashtag"),
      text: t("home.featuresHashtagDesc"),
    },
    {
      icon: "feed" as const,
      title: t("home.featuresFeed"),
      text: t("home.featuresFeedDesc"),
    },
  ] as const;

  const SAMPLE_PROMPT = t("home.samplePrompt");
  const SAMPLE_OUTPUT = t("home.sampleOutput");

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string>("kadin");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHashtags, setUseHashtags] = useState(true);
  const [carouselMode, setCarouselMode] = useState(false);
  const [captionMode, setCaptionMode] = useState<"alternatives" | "per_image">("alternatives");
  const [isPremium, setIsPremium] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const customPromptRef = useRef<TextInput>(null);

  const { showToast } = useToast();

  const bottomSheetRef = useRef<BottomSheetModal | null>(null);

  const { user } = useAuth();
  const { generate, generatePerImage } = useGenerateCaption();
  const { checkout, loading: stripeLoading } = useStripePayment();

  const refreshProfile = useCallback(() => {
    api.getProfile().then((data) => {
      if (data?.credits_remaining !== undefined) setCredits(data.credits_remaining);
      if (data?.is_premium !== undefined) setIsPremium(data.is_premium);
    });
  }, []);

  const pay = usePayment(refreshProfile);

  useEffect(() => {
    if (!user) return;
    refreshProfile();
  }, [user, refreshProfile]);

  const captionCountRef = useRef(0);
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState?.key != null;

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && isGenerating) {
        console.log("[AppState] Uygulama ön plana geldi, veri kontrol ediliyor...");

        const checkData = async () => {
          await refreshProfile();
          try {
            const captions = await api.getCaptions();
            if (captions && captions.length > captionCountRef.current) {
              console.log("[AppState] Yeni veri bulundu! Yönlendiriliyor...");
              captionCountRef.current = captions.length;
              if (pollInterval) clearInterval(pollInterval);
              if (safetyTimeout) clearTimeout(safetyTimeout);
              setIsGenerating(false);
              if (isNavigationReady && Date.now() - lastNavigationTimestamp > 3000) {
                const targetId = captions[0].post_id;
                console.log(`[AppState] Yeni veri bulundu! Yönlendirilecek ID: ${targetId}`);
                setTimeout(() => {
                  router.push({
                    pathname: '/caption/[id]',
                    params: { id: targetId }
                  });
                }, 500);
              } else if (!isNavigationReady) {
                console.log("[AppState] Router henüz hazır değil, yönlendirme ertelendi.");
              }
              return true;
            }
          } catch {
            // keep polling
          }
          return false;
        };

        const firstResult = await checkData();
        if (firstResult) return;

        pollInterval = setInterval(async () => {
          const found = await checkData();
          if (found && pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }, 2000);

        safetyTimeout = setTimeout(() => {
          if (pollInterval) clearInterval(pollInterval);
          if (isGenerating) {
            setIsGenerating(false);
          }
        }, 15000);
      } else if (nextAppState.match(/inactive|background/)) {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (safetyTimeout) {
          clearTimeout(safetyTimeout);
          safetyTimeout = null;
        }
      }
    });

    return () => {
      subscription.remove();
      if (pollInterval) clearInterval(pollInterval);
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, [isGenerating, isNavigationReady, refreshProfile]);

  const handleGenerate = async () => {
    if (isGenerating) return;

    if (selectedImages.length === 0 || !selectedTone) {
      Alert.alert(t("home.alertMissingTitle"), t("home.alertMissingMessage"));
      return;
    }

    if (!isPremium && credits !== null && credits <= 0) {
      pay.setShowCreditModal(true);
      return;
    }

    const vipTones = ["viral", "luxury", "storyteller"];
    if (!isPremium && selectedTone && vipTones.includes(selectedTone)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowProModal(true);
      return;
    }

    setIsGenerating(true);
    showToast?.("Üretim başladı. Arka plana alabilirsiniz, hazır olduğunda bildirim göndereceğiz. ✨", "info");

    try {
      const genFn = captionMode === "per_image" ? generatePerImage : generate;
      const result = await genFn(
        selectedImages,
        selectedTone,
        selectedGender,
        ageRange || undefined,
        { length, useEmojis, useHashtags, customPrompt: isPremium ? customPrompt : undefined, carouselMode: isPremium ? carouselMode : false },
      );

      if (result) {
        setCredits(result.remainingCredits === -1 ? (isPremium ? -1 : 0) : result.remainingCredits);
        router.push({
          pathname: "/caption/[id]",
          params: {
            id: result.post_id,
            data: JSON.stringify({
              captions: result.captions,
              image_urls: selectedImages,
              credits_remaining: result.remainingCredits,
            }),
          },
        });
        setSelectedImages([]);
        setSelectedTone(null);
      }
      setIsGenerating(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        msg.toLowerCase().includes("fetch failed") ||
        msg.toLowerCase().includes("network") ||
        msg.toLowerCase().includes("bağlanılamadı") ||
        msg.toLowerCase().includes("zaman aşımı") ||
        (err as any)?.name === "AbortError" ||
        (err as any)?.status === 0 ||
        (err as any)?.status === 408;
      if (isNetworkError) {
        console.log("Fetch işlemi arka plana geçiş sebebiyle iptal edildi, sunucu işlemi devraldı.");
        showToast?.("İşlem arka planda devam ediyor, hazır olunca bildirim alacaksın. ⏳", "info");
        return;
      }
      if (msg.toLowerCase().includes("kredi")) {
        Alert.alert(
          t("outOfCredits.title"),
          t("outOfCredits.descriptionCaption"),
          [
            { text: t("common.later"), style: "cancel" },
            {
              text: t("outOfCredits.buyButton"),
              onPress: () => pay.setShowCreditModal(true),
            },
          ],
        );
      } else {
        Alert.alert(t("home.alertError"), msg);
      }
      setIsGenerating(false);
    }
  };

  const handleHowItWorks = () => {
    setShowHowItWorks(true);
  };

  const handleBuyCredits = async () => {
    const isTr = i18n.language?.startsWith("tr");
    const price = isTr ? "50.0" : "2.99";
    const currency = isTr ? "TRY" : "USD";
    try {
      await pay.initiatePayment(price, 10, currency);
    } catch {
      Alert.alert(t("common.error"), t("outOfCredits.paymentFailureDesc"));
    }
  };

  const canGenerate =
    selectedImages.length > 0 && !!selectedTone && !isGenerating;

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        scrollEnabled={!isGenerating}
        decelerationRate={0.99}
        bounces={true}
      >
        {/* ── Hero ── */}
        <View style={styles.section}>
          <GlassPanel style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t("home.heroBadge")}</Text>
          </GlassPanel>

          <Text style={styles.heroTitle}>{t("home.heroTitle")}</Text>
          <Text style={styles.heroSubtitle}>{t("home.heroSubtitle")}</Text>

          <View style={styles.heroActions}>
            <HapticButton
              style={[
                styles.primaryButton,
                !canGenerate && styles.primaryButtonMuted,
              ]}
              onPress={handleGenerate}
              activeOpacity={0.85}
              disabled={!canGenerate}
            >
              <Text style={styles.primaryButtonText}>
                {t("home.generateText")}
              </Text>
            </HapticButton>
            <HapticButton
              style={styles.secondaryButton}
              onPress={handleHowItWorks}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>
                {t("common.howItWorks")}
              </Text>
            </HapticButton>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <GlassPanel style={styles.statsRow}>
          {STATS_DATA.map((item) => (
            <View key={item.label} style={styles.statItem}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </GlassPanel>

        {/* ── CameraWidget (Çoklu Fotoğraf Seçimi) ── */}
        <CameraWidget
          selectedImages={selectedImages}
          onImagesChange={setSelectedImages}
        />

        {/* ── Preview Card (Hiç görsel seçilmediğinde rehber olarak gösterilir) ── */}
        {selectedImages.length === 0 && (
          <GlassPanel style={styles.previewCard}>
            <View style={styles.previewHead}>
              <Text style={styles.previewHeadText}>
                {t("home.previewHead")}
              </Text>
              <PulseDot />
            </View>
            <Text style={styles.previewPrompt}>{SAMPLE_PROMPT}</Text>
            <View style={styles.previewOutput}>
              <Text style={styles.previewOutputText}>{SAMPLE_OUTPUT}</Text>
            </View>
          </GlassPanel>
        )}

        {/* ── ToneSelector (En az 1 görsel seçildiğinde açılır) ── */}
        {selectedImages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.toneHeader}>
              <Text style={styles.sectionTitle}>{t("home.selectTone")}</Text>
              <HapticButton
                style={styles.toneSheetButton}
                onPress={() => bottomSheetRef.current?.present()}
              >
                <Text style={styles.toneSheetButtonText}>{t("common.seeAll")}</Text>
              </HapticButton>
            </View>
            <ToneSelector
              selectedTone={selectedTone}
              onToneSelect={setSelectedTone}
              isPremium={isPremium}
              onPremiumRequired={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setShowProModal(true);
              }}
            />
          </View>
        )}

        <GlassBottomSheet
          bottomSheetRef={bottomSheetRef}
          selectedTone={selectedTone}
          onToneSelect={setSelectedTone}
          isPremium={isPremium}
          onPremiumRequired={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setShowProModal(true);
          }}
        />

      {/* ── Fine-Tuning Panel ── */}
      {selectedImages.length > 0 && (
        <BlurView intensity={50} tint="systemThinMaterialDark" style={styles.tuningCard}>
          <Text style={styles.tuningTitle}>{t("settings.title")}</Text>

          <View style={styles.lengthRow}>
            {(["short", "medium", "long"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setLength(opt)}
                style={[
                  styles.lengthChip,
                  length === opt && styles.lengthChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.lengthChipText,
                    length === opt && styles.lengthChipTextActive,
                  ]}
                >
                  {t(`settings.${opt}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.lengthRow}>
            {(["female", "male", "corporate"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  if (opt === "corporate" && !isPremium) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setShowProModal(true);
                    return;
                  }
                  setSelectedGender(opt);
                }}
                style={[
                  styles.lengthChip,
                  selectedGender === opt && styles.lengthChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.lengthChipText,
                    selectedGender === opt && styles.lengthChipTextActive,
                  ]}
                >
                  {opt === "corporate" && !isPremium ? "👑 " : ""}{t(`settings.${opt}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.tuningSubtitle, { marginTop: 16 }]}>{t("settings.captionMode")}</Text>
          <View style={styles.lengthRow}>
            {(["alternatives", "per_image"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setCaptionMode(opt)}
                style={[
                  styles.lengthChip,
                  captionMode === opt && styles.lengthChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.lengthChipText,
                    captionMode === opt && styles.lengthChipTextActive,
                  ]}
                >
                  {t(`settings.${opt === "alternatives" ? "modeAlternatives" : "modePerImage"}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons
                name="happy-outline"
                size={18}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.switchText}>{t("settings.emojis")}</Text>
            </View>
            <Switch
              value={useEmojis}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setUseEmojis(v);
              }}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: "#8B5CF6" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons
                name="pricetags-outline"
                size={18}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.switchText}>{t("settings.hashtags")}</Text>
            </View>
            <Switch
              value={useHashtags}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setUseHashtags(v);
              }}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: "#8B5CF6" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons
                name="images-outline"
                size={18}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.switchText}>{t("settings.carouselMode")}</Text>
            </View>
            <Switch
              value={isPremium ? carouselMode : false}
              onValueChange={(v) => {
                if (!isPremium) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  setShowProModal(true);
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCarouselMode(v);
              }}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: "#8B5CF6" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Text style={[styles.tuningSubtitle, { marginTop: 16 }]}>{t("settings.customPrompt")}</Text>
          <TextInput
            ref={customPromptRef}
            style={[
              styles.customPromptInput,
              !isPremium && styles.customPromptInputLocked,
            ]}
            value={isPremium ? customPrompt : ""}
            onChangeText={isPremium ? setCustomPrompt : undefined}
            placeholder={isPremium ? t("settings.customPromptPlaceholder") : "👑  " + t("settings.customPromptPremiumOnly")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={isPremium}
            onFocus={() => {
              if (!isPremium) {
                Keyboard.dismiss();
                customPromptRef.current?.blur();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setShowProModal(true);
              }
            }}
          />
        </BlurView>
      )}

        {/* ── Features Carousel ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuresRow}
        >
          {FEATURES_DATA.map((feature) => (
            <GlassPanel key={feature.title} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>
                {renderFeatureIcon(feature.icon)}
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureText}>{feature.text}</Text>
            </GlassPanel>
          ))}
        </ScrollView>

        {/* ── Closing CTA ── */}
        <GlassPanel style={styles.closingCta}>
          <Text style={styles.closingTitle}>{t("home.closingTitle")}</Text>
          <Text style={styles.closingText}>{t("home.closingText")}</Text>
          <HapticButton
            style={[
              styles.primaryButton,
              !canGenerate && styles.primaryButtonMuted,
            ]}
            onPress={handleGenerate}
            activeOpacity={0.85}
            disabled={!canGenerate}
          >
            <Text style={styles.primaryButtonText}>
              {t("common.freeTrial")}
            </Text>
          </HapticButton>
        </GlassPanel>
      </ScrollView>

      <Modal
        transparent
        visible={showProModal}
        animationType="slide"
        onRequestClose={() => setShowProModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="systemThinMaterialDark" style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowProModal(false)}
            >
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            <Ionicons
              name="diamond"
              size={64}
              color="#8B5CF6"
              style={styles.modalIcon}
            />

            <Text style={styles.modalTitle}>{t("premium.title")}</Text>
            <Text style={styles.modalDesc}>{t("premium.description")}</Text>

            <Pressable
              style={[styles.modalCta, stripeLoading && styles.modalCtaMuted]}
              onPress={async () => {
                const result = await checkout(999, "usd", user?.id);
                if (result.success) {
                  refreshProfile();
                  setShowProModal(false);
                }
              }}
              disabled={stripeLoading}
            >
              <Ionicons name="star" size={18} color="#FFFFFF" />
              <Text style={styles.modalCtaText}>
                {stripeLoading ? t("common.loading") : t("premium.cta")}
              </Text>
            </Pressable>

            <Pressable onPress={() => setShowProModal(false)}>
              <Text style={styles.modalSkip}>{t("premium.skip")}</Text>
            </Pressable>
          </BlurView>
        </View>
      </Modal>

      <AILoadingOverlay visible={isGenerating} />
      <HowItWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
      <OutOfCreditsModal
        visible={pay.showCreditModal}
        onClose={() => pay.setShowCreditModal(false)}
        onBuy={handleBuyCredits}
      />
      {pay.paymentUrl && (
        <PaymentWebViewModal
          visible={pay.showWebView}
          paymentUrl={pay.paymentUrl}
          onSuccess={pay.handlePaymentSuccess}
          onFailure={pay.handlePaymentFailure}
          onClose={pay.closeWebView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 14,
    paddingTop: 100,
    paddingBottom: 140,
    gap: 24,
  },

  /* ── Sections ── */
  section: {
    gap: 14,
  },

  /* ── Hero ── */
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: GlassTheme.radiusPill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: GlassTheme.textMain,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: GlassTheme.textMain,
    lineHeight: 36,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: GlassTheme.textMuted,
    lineHeight: 21,
    letterSpacing: 0.3,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    backgroundColor: GlassTheme.primaryButtonBg,
    borderRadius: GlassTheme.radiusPill,
    justifyContent: "center",
    alignItems: "center",
    ...GlassTheme.cardShadow,
  },
  primaryButtonMuted: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: GlassTheme.primaryButtonText,
    letterSpacing: -0.2,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: GlassTheme.radiusPill,
    borderWidth: 1.5,
    borderColor: GlassTheme.border,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },

  /* ── Stats Row ── */
  statsRow: {
    flexDirection: "row",
    borderRadius: GlassTheme.radiusMd,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: GlassTheme.textMain,
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    marginTop: 3,
  },

  /* ── Preview Card ── */
  previewCard: {
    borderRadius: GlassTheme.radiusLg,
    padding: 14,
  },
  previewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  previewHeadText: {
    fontSize: 12,
    fontWeight: "700",
    color: GlassTheme.textMain,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#6cff8c",
  },
  previewPrompt: {
    fontSize: 12,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    marginBottom: 10,
  },
  previewOutput: {
    borderRadius: 14,
    padding: 11,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  previewOutputText: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMain,
    lineHeight: 19,
  },

  /* ── Tone Section ── */
  toneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GlassTheme.textMain,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  toneSheetButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  toneSheetButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: GlassTheme.textMuted,
    letterSpacing: 0.5,
  },

  /* ── Fine-Tuning Panel ── */
  tuningCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    gap: 16,
  },
  tuningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  tuningSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  lengthRow: {
    flexDirection: "row",
    gap: 8,
  },
  lengthChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  lengthChipActive: {
    backgroundColor: "#8B5CF6",
  },
  lengthChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  lengthChipTextActive: {
    color: "#FFFFFF",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switchText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },

  /* ── Features Carousel ── */
  featuresRow: {
    gap: 12,
    paddingBottom: 4,
  },
  featureCard: {
    width: 230,
    borderRadius: GlassTheme.radiusMd,
    padding: 16,
    flexDirection: "column",
    gap: 12,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(122,83,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(122,83,255,0.3)",
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GlassTheme.textMain,
    letterSpacing: 0.5,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    lineHeight: 19,
  },

  /* ── Premium Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.5)",
    padding: 32,
    alignItems: "center",
    overflow: "hidden",
  },
  modalCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  modalIcon: {
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  modalCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8B5CF6",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  modalCtaMuted: {
    opacity: 0.5,
  },
  modalCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalSkip: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
    textDecorationLine: "underline",
  },

  /* ── Closing CTA ── */
  closingCta: {
    borderRadius: GlassTheme.radiusLg,
    padding: 20,
    gap: 14,
  },
  closingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: GlassTheme.textMain,
    lineHeight: 26,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  closingText: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    lineHeight: 19,
  },

  customPromptInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    minHeight: 80,
  },
  customPromptInputLocked: {
    opacity: 0.5,
    borderColor: "rgba(251,191,36,0.25)",
  },

});
