import HapticButton from "@/components/HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCachedImageUris } from "../../services/api";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

interface CaptionItem {
  text?: string;
  hashtags?: string[];
}

interface DetailScreenData {
  captions: CaptionItem[];
  image_url: string;
  image_urls?: string[];
  credits_remaining: number;
}

function GlassCard({
  caption,
  index,
  onCopy,
  copiedIndex,
  t,
}: {
  caption: CaptionItem;
  index: number;
  onCopy: (text: string, index: number) => void;
  copiedIndex: number | null;
  t: (key: string) => string;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scale]);

  return (
    <Reanimated.View
      entering={FadeInUp.delay(index * 120)
        .springify()
        .damping(14)}
    >
      <Reanimated.View style={[animatedStyle, styles.cardShadow]}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.cardBlur}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardLabel}>{t("common.alternative")} {index + 1}</Text>

              <Text style={styles.cardText}>{caption.text ?? ''}</Text>

              {(caption.hashtags ?? []).length > 0 && (
                <View style={styles.hashtagRow}>
                  {(caption.hashtags ?? []).map((tag, tagIndex) => (
                    <View key={tagIndex} style={styles.hashtag}>
                      <Text style={styles.hashtagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <HapticButton
                style={styles.copyButton}
                onPress={() => onCopy(caption.text ?? '', index)}
                activeOpacity={0.7}
              >
                <Text style={styles.copyButtonText}>
                  {copiedIndex === index ? t("common.copied") : t("common.copyLabel")}
                </Text>
              </HapticButton>
            </View>
          </BlurView>
        </Pressable>
      </Reanimated.View>
    </Reanimated.View>
  );
}

export default function CaptionDetailScreen() {
  const { t } = useTranslation();
  const { id, data: dataParam } = useLocalSearchParams<{
    id: string;
    data?: string;
  }>();

  const inlineData: DetailScreenData | null = useMemo(() => {
    if (!dataParam || typeof dataParam !== "string") return null;
    try {
      return JSON.parse(dataParam) as DetailScreenData;
    } catch {
      return null;
    }
  }, [dataParam]);

  const [captions, setCaptions] = useState<CaptionItem[]>(
    (inlineData?.captions ?? []).map((item: any) =>
      typeof item === "string" ? { text: item, hashtags: [] } : item,
    ),
  );

  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    const cached = getCachedImageUris(id);
    if (cached && cached.length > 0) return cached;
    return inlineData?.image_urls ??
      (inlineData?.image_url ? [inlineData.image_url] : []);
  });

  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(
    inlineData?.credits_remaining ?? null,
  );

  const [loading, setLoading] = useState(!inlineData);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Modal ve WebView State'leri
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (inlineData) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: post } = await supabase
        .from("posts")
        .select("image_url")
        .eq("id", id)
        .single();

      if (post && post.image_url) {
        setImageUrls([post.image_url]);
      }

      const { data: captionRows } = await supabase
        .from("generated_captions")
        .select("caption_text, hashtags")
        .eq("post_id", id)
        .order("id");

      if (captionRows) {
        setCaptions(
          (captionRows as { caption_text: string; hashtags: string[] }[]).map(
            (row) => ({ text: row.caption_text, hashtags: row.hashtags }),
          ),
        );
      }

      setLoading(false);
    };

    fetchData();
  }, [id, inlineData]);

  const handleCopy = useCallback(
    async (text: string, index: number) => {
      try {
        await Clipboard.setStringAsync(text);
        setCopiedIndex(index);
        showToast(t("common.copiedDesc"), "success");
        setTimeout(() => setCopiedIndex(null), 2000);
      } catch {
        Alert.alert(t("home.alertError"), t("common.alertClipboardError"));
      }
    },
    [showToast],
  );

  const handleShare = useCallback(async (textToShare: string) => {
    if (!textToShare) {
      Alert.alert(t("common.error"), t("common.alertShareError"));
      return;
    }
    try {
      await Share.share({ message: textToShare });
    } catch {
      Alert.alert(t("home.alertError"), t("common.alertShareError"));
    }
  }, [t]);

  const handleInstagram = useCallback(async (textToShare: string) => {
    if (!textToShare) return;
    await Clipboard.setStringAsync(textToShare);
    Alert.alert(
      t("common.copiedTitle"),
      t("common.copiedInstagramDesc"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.openInstagram"),
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL("instagram://app");
              if (canOpen) {
                await Linking.openURL("instagram://app");
              } else {
                Alert.alert(
                  t("common.alertInstagramNotFound"),
                  t("common.alertInstagramNotInstalled"),
                );
              }
            } catch {
              Alert.alert(t("home.alertError"), t("common.alertInstagramOpenError"));
            }
          },
        },
      ],
    );
  }, [t]);

  // Canlı URL'ye İstek Atarak iyzico'yu Başlatma
  const initiateIyzicoPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        "https://rkacxgouberhvygsefqu.supabase.co/functions/v1/iyzico-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            userId: session?.user?.id,
            packageId: "premium_10_credits",
          }),
        },
      );

      const result = await response.json();

      if (result?.paymentUrl) {
        setPaymentUrl(result.paymentUrl);
        setShowCreditModal(false);
        setShowWebView(true);
      } else {
        Alert.alert(t("home.alertError"), result?.error || t("outOfCredits.paymentLinkError"));
      }
    } catch (error) {
      Alert.alert(t("outOfCredits.connectionError"), t("outOfCredits.connectionErrorDesc"));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // WebView içerisindeki URL değişimlerini yakalama
  const handleWebViewNavigation = (navState: any) => {
    const { url } = navState;
    if (url.includes("payment-success")) {
      setShowWebView(false);
      Alert.alert(t("outOfCredits.paymentSuccessTitle"), t("outOfCredits.paymentSuccessDesc"));
      if (creditsRemaining !== null) {
        setCreditsRemaining(creditsRemaining + 10);
      }
    } else if (url.includes("payment-failure")) {
      setShowWebView(false);
      Alert.alert(t("outOfCredits.paymentFailureTitle"), t("outOfCredits.paymentFailureDesc"));
    }
  };

  console.log("[Caption] imageUrls.length:", imageUrls.length);
  console.log("[Caption] first imageUri (50 chars):", imageUrls[0]?.substring(0, 50));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GlassTheme.textMain} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
          >
            <Ionicons name="arrow-back" size={24} color={GlassTheme.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("common.details")}</Text>
          <TouchableOpacity onPress={() => {}} style={styles.headerBtn}>
            <Ionicons
              name="settings-outline"
              size={24}
              color={GlassTheme.textMain}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate={0.99}
        bounces={true}
      >
        {imageUrls.length > 0 && (
          <Reanimated.View
            entering={FadeInUp.springify().damping(14)}
            style={styles.imageSection}
          >
            <View style={styles.imageCarouselWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageCarousel}
                decelerationRate="fast"
                snapToInterval={132}
                snapToAlignment="start"
                disableIntervalMomentum={true}
              >
                {imageUrls.map((uri, idx) => (
                  <BlurView
                    key={idx}
                    intensity={GlassTheme.blurIntensity}
                    tint="dark"
                    style={styles.imageBlurWrapper}
                  >
                    <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                  </BlurView>
                ))}
              </ScrollView>
            </View>

            {/* Kredi Testi İçin Tıklanabilir Rozet */}
            {creditsRemaining !== null && (
              <TouchableOpacity
                onPress={() => setShowCreditModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.creditBadge}>
                  {t("common.creditRemaining", { count: creditsRemaining })}
                </Text>
              </TouchableOpacity>
            )}
          </Reanimated.View>
        )}

        <Reanimated.Text
          entering={FadeInUp.springify().damping(14)}
          style={styles.sectionTitle}
        >
          {t("common.outputs")}
        </Reanimated.Text>

        {captions.length === 0 ? (
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.emptyCard}
          >
            <Text style={styles.emptyText}>{t("common.emptyTexts")}</Text>
          </BlurView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
          >
            {captions.map((caption, index) => {
              console.log("GlassCard'a gelen veri:", JSON.stringify(caption, null, 2));
              return (
                <GlassCard
                  key={index}
                  caption={caption}
                  index={index}
                  onCopy={handleCopy}
                  copiedIndex={copiedIndex}
                  t={t}
                />
              );
            })}
          </ScrollView>
        )}

        <View style={styles.shareRow}>
          <HapticButton
            style={[styles.shareButton, styles.shareButtonHalf]}
            onPress={() => handleInstagram(captions[0]?.text ?? '')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[...GlassTheme.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareGradient}
            >
              <Ionicons name="logo-instagram" size={18} color="#FFF" />
              <Text style={styles.shareButtonText}> {t("common.instagram")}</Text>
            </LinearGradient>
          </HapticButton>

          <HapticButton
            style={[styles.shareButton, styles.shareButtonHalf]}
            onPress={() => handleShare(captions[0]?.text ?? '')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[...GlassTheme.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareGradient}
            >
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={styles.shareButtonText}> {t("common.share")}</Text>
            </LinearGradient>
          </HapticButton>
        </View>
      </ScrollView>



      {/* "YAPAY ZEKA YAKITIN TÜKENDİ" LÜKS MODALI */}
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
              {t("outOfCredits.descriptionCaption")}
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
                  <Text style={styles.purchaseButtonText}>{t("outOfCredits.buyButton")}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterButton}
              onPress={() => setShowCreditModal(false)}
            >
              <Text style={styles.laterButtonText}>{t("outOfCredits.later")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* IYZICO WEBVIEW MODALI */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="pageSheet" // iOS'ta şık bir aşağı çekilebilir kart olarak açılır
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: GlassTheme.background }}
        >
          <View style={styles.webviewHeader}>
            <TouchableOpacity onPress={() => setShowWebView(false)}>
              <Text style={styles.webviewCancelText}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.webviewTitle}>Güvenli Ödeme</Text>
            <View style={{ width: 40 }} />
          </View>

          {paymentUrl && (
            <WebView
              source={{ uri: paymentUrl }}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              mixedContentMode="always"
              cacheEnabled={false}
              setSupportMultipleWindows={false}
              onNavigationStateChange={handleWebViewNavigation}
              startInLoadingState={true}
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
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: GlassTheme.background,
  },
  safeArea: {
    backgroundColor: GlassTheme.background,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    height: 60,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: GlassTheme.textMain,
    textAlign: "center",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 18,
    paddingBottom: 48,
  },
  imageSection: {
    marginBottom: 24,
    marginTop: 8,
  },
  imageCarouselWrapper: {
    marginHorizontal: -20,
  },
  imageCarousel: {
    paddingHorizontal: 20,
    gap: 12,
  },
  imageBlurWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: GlassTheme.vibrantBorder,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 18,
    margin: 2,
    backgroundColor: GlassTheme.panelStrong,
  },
  creditBadge: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    color: GlassTheme.textMain,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 18,
    color: GlassTheme.textMain,
  },
  emptyCard: {
    borderRadius: GlassTheme.cardBorderRadius,
    padding: 32,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: GlassTheme.vibrantBorder,
    overflow: "hidden",
  },
  emptyText: {
    fontSize: 14,
    color: GlassTheme.textSub,
    textAlign: "center",
  },
  cardsRow: {
    gap: 16,
    paddingBottom: 8,
  },
  cardShadow: {
    ...GlassTheme.cardShadow,
  },
  cardBlur: {
    width: GlassTheme.cardWidth,
    borderRadius: GlassTheme.cardBorderRadius,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: GlassTheme.glassBorder,
  },
  cardInner: {
    padding: 20,
    backgroundColor: GlassTheme.cardBackground,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: GlassTheme.textSub,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22,
    color: GlassTheme.textMain,
    marginBottom: 16,
  },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  hashtag: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: GlassTheme.glassBg,
    borderWidth: 0.5,
    borderColor: GlassTheme.glassBorder,
  },
  hashtagText: {
    fontSize: 12,
    fontWeight: "400",
    color: GlassTheme.textMain,
  },
  copyButton: {
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: GlassTheme.vibrantBorder,
    alignItems: "center",
    backgroundColor: GlassTheme.glassBg,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },
  shareRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  shareButton: {
    borderRadius: 16,
    overflow: "hidden",
    flex: 1,
    ...GlassTheme.cardShadow,
  },
  shareButtonHalf: {},
  shareGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: GlassTheme.textMain,
  },
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
