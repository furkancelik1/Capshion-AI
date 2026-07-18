import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import AmbientGlow from "../../components/AmbientGlow";
import CameraWidget from "../../components/CameraWidget";
import GeneratingModal from "../../components/GeneratingModal";
import {
  FeedIcon,
  HashtagIcon,
  SparkleIcon,
  ToneIcon,
} from "../../components/GlassIcons";
import GlassPanel from "../../components/GlassPanel";
import HapticButton from "../../components/HapticButton";
import HowItWorksModal from "../../components/HowItWorksModal";
import ToneSelector from "../../components/ToneSelector";
import { GlassTheme } from "../../constants/LiquidGlass";
import { useAuth } from "../../hooks/useAuth";
import { useGenerateCaption } from "../../hooks/useGenerateCaption";
import { api, getToken } from "../../services/api";

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

  Animated.loop(
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
  ).start();

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
  const [selectedGender, setSelectedGender] = useState<string>("erkek");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [ageRange, setAgeRange] = useState<string | null>(null);

  const { user } = useAuth();
  const { generate } = useGenerateCaption();

  useEffect(() => {
    if (!user) return;
    api.getProfile().then((data) => {
      if (data?.age_range) setAgeRange(data.age_range);
      if (data?.credits_remaining !== undefined) setCredits(data.credits_remaining);
    });
  }, [user]);

  const handleGenerate = async () => {
    if (selectedImages.length === 0 || !selectedTone) {
      Alert.alert(t("home.alertMissingTitle"), t("home.alertMissingMessage"));
      return;
    }

    if (credits !== null && credits <= 0) {
      setShowCreditModal(true);
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generate(
        selectedImages,
        selectedTone,
        selectedGender,
        ageRange || undefined,
      );

      if (result) {
        setCredits(result.remainingCredits);
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
    } catch (err: any) {
      console.log("[Generate] Kredi veya baglanti uyarisi:", err.message);
      const msg = err.message || err.toString() || "";
      if (msg.toLowerCase().includes("kredi")) {
        Alert.alert(
          t("outOfCredits.title") || "Yetersiz Kredi",
          t("outOfCredits.descriptionCaption") || "Krediniz yetersiz.",
          [
            { text: t("common.later") || "Iptal", style: "cancel" },
            {
              text: t("outOfCredits.buyButton") || "Kredi Yukle",
              onPress: () => setShowCreditModal(true),
            },
          ],
        );
      } else {
        Alert.alert(t("home.alertError"), msg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHowItWorks = () => {
    setShowHowItWorks(true);
  };

  const initiateIyzicoPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const isTr = i18n.language?.startsWith("tr");
      const apiUrl = "http://192.168.1.101:3000/api/payment/create";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          price: isTr ? "50.0" : "2.99",
          credits: 10,
          currency: isTr ? "TRY" : "USD",
        }),
      });
      const result = await response.json();
      console.log("[Iyzico] Backend yaniti:", result);
      if (result?.paymentUrl) {
        setPaymentUrl(result.paymentUrl);
        setShowCreditModal(false);
        setShowWebView(true);
      } else {
        Alert.alert("Hata", result?.error || "Odeme linki alinamadi.");
      }
    } catch (error) {
      console.error("[Network Hatasi]:", error);
      Alert.alert("Baglanti Hatasi", "Sunucuya ulasilamadi.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleWebViewNavigation = (navState: any) => {
    const { url } = navState;
    if (url.includes("payment-success")) {
      setShowWebView(false);
      api.getProfile().then((data) => {
        if (data?.credits_remaining !== undefined) setCredits(data.credits_remaining);
      });
      Alert.alert(
        t("outOfCredits.paymentSuccessTitle"),
        t("outOfCredits.paymentSuccessDesc"),
      );
    } else if (url.includes("payment-failure")) {
      setShowWebView(false);
      Alert.alert(
        t("outOfCredits.paymentFailureTitle"),
        t("outOfCredits.paymentFailureDesc"),
      );
    }
  };

  // En az bir görsel ve bir ton seçildiyse ve işlem yapılmıyorsa buton aktif olur
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
        {/* ── Top Nav ── */}
        <GlassPanel style={styles.topNav}>
          <View style={styles.brandRow}>
            <SparkleIcon size={20} />
            <Text style={styles.brandText}>Capshion</Text>
          </View>
          <GlassPanel style={styles.betaPill}>
            <Text style={styles.betaText}>{t("common.beta")}</Text>
          </GlassPanel>
        </GlassPanel>

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
            <Text style={styles.sectionTitle}>{t("home.selectTone")}</Text>
            <ToneSelector
              selectedTone={selectedTone}
              onToneSelect={setSelectedTone}
            />
          </View>
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

      <GeneratingModal visible={isGenerating} />
      <HowItWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
      {/* ================= KREDI YUKLEME MODALI ================= */}
      <Modal visible={showCreditModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.creditModalCard}>
            <View style={styles.creditIconWrapper}>
              <Ionicons name="battery-dead" size={32} color="#8B5CF6" />
            </View>
            <Text style={styles.creditModalTitle}>
              {t("outOfCredits.title")}
            </Text>
            <Text style={styles.creditModalDesc}>
              {i18n.language?.startsWith("tr") ? "10 Kredi - ₺50" : "10 Credits - $2.99"}
            </Text>

            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={initiateIyzicoPayment}
              disabled={isProcessingPayment}
            >
              <LinearGradient
                colors={[...GlassTheme.gradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.purchaseGradient}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.purchaseButtonText}>
                    {t("outOfCredits.buyButton")}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterButton}
              onPress={() => setShowCreditModal(false)}
            >
              <Text style={styles.laterButtonText}>{t("common.later")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= IYZICO WEBVIEW MODALI ================= */}
      <Modal
        visible={showWebView}
        animationType="slide"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: GlassTheme.bg }}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity onPress={() => setShowWebView(false)}>
              <Text style={styles.webviewCancelText}>
                {t("common.cancel") || "Iptal"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.webviewTitle}>
              {t("outOfCredits.securePayment") || "Guvenli Odeme"}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1 }}>
            {paymentUrl && (
              <WebView
                source={{ uri: paymentUrl }}
                originWhitelist={['*']}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                mixedContentMode="always"
                cacheEnabled={false}
                setSupportMultipleWindows={false}
                setBuiltInZoomControls={false}
                setDisplayZoomControls={false}
                overScrollMode="never"
                onNavigationStateChange={handleWebViewNavigation}
                startInLoadingState={true}
                style={{ flex: 1, backgroundColor: "transparent" }}
                renderLoading={() => (
                  <ActivityIndicator
                    size="large"
                    color="#8B5CF6"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      marginLeft: -18,
                      marginTop: -18,
                    }}
                  />
                )}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GlassTheme.bg,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 14,
    paddingTop: 18,
    paddingBottom: 60,
    gap: 24,
  },

  /* ── Top Nav ── */
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: GlassTheme.radiusPill,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    color: GlassTheme.textMain,
    letterSpacing: -0.3,
  },
  betaPill: {
    borderRadius: GlassTheme.radiusPill,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    backgroundColor: GlassTheme.panelStrong,
  },
  betaText: {
    fontSize: 12,
    fontWeight: "600",
    color: GlassTheme.textMain,
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
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: GlassTheme.textMain,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: GlassTheme.textMain,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: GlassTheme.textMuted,
    lineHeight: 21,
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
    letterSpacing: -0.4,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GlassTheme.textMain,
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
    letterSpacing: -0.4,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    lineHeight: 19,
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
    letterSpacing: -0.5,
  },
  closingText: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    lineHeight: 19,
  },

  /* ── Credit Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  creditModalCard: {
    backgroundColor: "rgba(25, 25, 25, 0.95)",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  creditIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  creditModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  creditModalDesc: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  purchaseButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  purchaseGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  purchaseButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  laterButtonText: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "600",
  },
  webviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  webviewCancelText: {
    color: "#8B5CF6",
    fontSize: 16,
    fontWeight: "500",
  },
  webviewTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
