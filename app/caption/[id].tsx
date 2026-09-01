import TypeWriterText from "@/components/TypeWriterText";
import GlassSkeleton from "@/components/GlassSkeleton";
import HapticButton from "@/components/HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCachedImageUris, api } from "../../services/api";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  InteractionManager,
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
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

interface CaptionItem {
  text?: string;
  hashtags?: string[];
  image_index?: number;
  image_url?: string;
}

interface DetailScreenData {
  captions: CaptionItem[];
  image_url: string;
  image_urls?: string[];
  credits_remaining: number;
}

function PerImageCard({
  caption,
  imageUri,
  index,
  onCopy,
  copiedIndex,
  t,
}: {
  caption: CaptionItem;
  imageUri: string;
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
      entering={FadeInDown.delay(index * 150).springify().damping(14)}
      style={styles.perImageCard}
    >
      <Reanimated.View style={[animatedStyle, styles.cardShadow]}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="systemThinMaterialLight"
            style={styles.cardBlur}
          >
            <View style={styles.cardInner}>
              <ExpoImage source={{ uri: imageUri }} style={styles.perImagePreview} contentFit="cover" cachePolicy="memory-disk" />
              <Text style={styles.perImageLabel}>{t("common.image")} {index + 1}</Text>
              <TypeWriterText text={caption.text ?? ''} delay={(index + 1) * 150 + 200} />
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
                style={styles.perImageCopyButton}
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
      entering={FadeInDown.delay(index * 150)
        .springify()
        .damping(14)}
    >
      <Reanimated.View style={[animatedStyle, styles.cardShadow]}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="systemThinMaterialLight"
            style={styles.cardBlur}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardLabel}>{t("common.alternative")} {index + 1}</Text>

              <TypeWriterText text={caption.text ?? ''} delay={(index + 1) * 150 + 200} />

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

  const isPerImage = captions.length > 0 && captions.some((c) => c.image_index !== undefined && c.image_index !== null);

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [localData, setLocalData] = useState<any[] | null>(null);
  const [isTransitionReady, setIsTransitionReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsTransitionReady(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
  }, []);

  // Kredi Modalı State'i
  const [showCreditModal, setShowCreditModal] = useState(false);

  const { showToast } = useToast();

  const parseCaptionRows = (rows: any[]): CaptionItem[] => {
    return rows
      .map((row) => {
      let text = "";
      let hashtags: string[] = [];

      if (typeof row.caption_text === "string") {
        try {
          const parsed = JSON.parse(row.caption_text);
          if (Array.isArray(parsed)) {
            text = parsed.join(" ");
          } else if (typeof parsed === "string") {
            text = parsed;
          } else {
            text = row.caption_text;
          }
        } catch {
          text = row.caption_text;
        }
      } else if (row.caption_text && typeof row.caption_text === "object") {
        text = String(row.caption_text);
      }

      if (Array.isArray(row.hashtags)) {
        hashtags = row.hashtags;
      } else if (typeof row.hashtags === "string") {
        try {
          const parsed = JSON.parse(row.hashtags);
          hashtags = Array.isArray(parsed) ? parsed : [row.hashtags];
        } catch {
          hashtags = [row.hashtags];
        }
      }

      return { text, hashtags };
    })
    .filter((item) => item.text.trim().length > 0);
  };

  const fetchInProgressRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (inlineData) return;
      if (fetchInProgressRef.current) return;

      let isActive = true;

      const fetchLatestData = async (retries = 0) => {
        if (!id) {
          console.log("[Details] ID parametresi henüz gelmedi, bekleniyor...");
          return;
        }

        try {
          fetchInProgressRef.current = true;
          setIsRefreshing(true);

          const rows = await api.getCaptionByPostId(id);

          if (isActive && rows && rows.length > 0) {
            console.log("[Details Render Debug] API'den gelen raw veri (focus):", JSON.stringify(rows));
            setLocalData(rows);
            const first = rows[0];
            const imgUrl = first.image_url && first.image_url !== "base64" ? first.image_url : "";
            if (imgUrl) {
              setImageUrls([imgUrl]);
            }
            setCaptions(parseCaptionRows(rows as any[]));
          } else if (isActive && retries < 2) {
            setTimeout(() => fetchLatestData(retries + 1), 1000);
            return;
          }
        } catch (error) {
          console.error("Veri yenileme hatası:", error);
          if (isActive && retries < 2) {
            setTimeout(() => fetchLatestData(retries + 1), 1000);
            return;
          }
        } finally {
          if (isActive) {
            fetchInProgressRef.current = false;
            setIsRefreshing(false);
            setLoading(false);
          }
        }
      };

      fetchLatestData();

      return () => {
        isActive = false;
      };
    }, [id, inlineData]),
  );

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

  // Kredi satın almak için RevenueCat paywall'a yönlendirme
  const goToPaywall = () => {
    setShowCreditModal(false);
    router.push("/paywall");
  };

  // Paywall'dan dönüşte güncel kredi bilgisini çek
  useFocusEffect(
    useCallback(() => {
      api.getProfile().then((data) => {
        if (data?.credits_remaining !== undefined) setCreditsRemaining(data.credits_remaining);
      }).catch(() => {});
    }, []),
  );

  console.log("[Caption] imageUrls.length:", imageUrls.length);
  console.log("[Caption] first imageUri (50 chars):", imageUrls[0]?.substring(0, 50));
  console.log("[Details Image Debug] localData:", localData);
  console.log("[Details Image Debug] inlineData?.image_urls:", inlineData?.image_urls);
  console.log("[Image Debug] Mevcut Obje:", captions?.[0] || localData);

  if (!isTransitionReady) {
    return <View style={styles.container} />;
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerBtn} />
            <Text style={styles.headerTitle}>{t("common.details")}</Text>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>
        <View style={styles.content}>
          <GlassSkeleton width="100%" height={130} borderRadius={20} />
          <View style={{ height: 24 }} />
          <GlassSkeleton width={140} height={20} borderRadius={8} />
          <View style={{ height: 16 }} />
          <GlassSkeleton width="100%" height={200} borderRadius={20} />
          <View style={{ height: 16 }} />
          <GlassSkeleton width="100%" height={200} borderRadius={20} />
          <View style={{ height: 100 }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <GlassSkeleton style={{ flex: 1 }} height={56} borderRadius={16} />
            <GlassSkeleton style={{ flex: 1 }} height={56} borderRadius={16} />
          </View>
        </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {creditsRemaining !== null && (
              <TouchableOpacity onPress={() => setShowCreditModal(true)} activeOpacity={0.7}>
                <Text style={styles.creditBadgeHeader}>
                  {`🔋${creditsRemaining}`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => {}} style={styles.headerBtn}>
              <Ionicons
                name="settings-outline"
                size={24}
                color={GlassTheme.textMain}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate={0.99}
        bounces={true}
      >
        {!isPerImage && (
          <Reanimated.View
            entering={FadeInUp.springify().damping(14)}
            style={{ marginBottom: 24, paddingHorizontal: 20 }}
          >
            {(() => {
              const targetImageUrl = imageUrls[0] || captions?.[0]?.image_url || localData?.[0]?.image_url;

              return targetImageUrl && targetImageUrl !== "base64" ? (
                <ExpoImage
                  source={{ uri: targetImageUrl }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(0,0,0,0.06)'
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={300}
                />
              ) : (
                <View style={{
                  width: 120,
                  height: 120,
                  borderRadius: 16,
                  backgroundColor: '#F2F2F7',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.06)'
                }}>
                  <Ionicons name="image-outline" size={32} color="#C7C7CC" />
                </View>
              );
            })()}
          </Reanimated.View>
        )}

        <Reanimated.Text
          entering={FadeInUp.springify().damping(14)}
          style={styles.sectionTitle}
        >
          {t("common.outputs")}
        </Reanimated.Text>

        {captions.length === 0 ? (
          <Reanimated.View entering={FadeInUp.delay(300).springify().damping(14)}>
            <BlurView
              intensity={GlassTheme.blurIntensity}
              tint="systemThinMaterialLight"
              style={styles.emptyCard}
            >
              <Text style={styles.emptyText}>
                {isRefreshing ? t("common.refreshing") : t("common.emptyTexts")}
              </Text>
            </BlurView>
          </Reanimated.View>
        ) : isPerImage ? (
          captions.map((caption, index) => (
            <PerImageCard
              key={index}
              caption={caption}
              imageUri={imageUrls[caption.image_index ?? index] ?? imageUrls[0]}
              index={index}
              onCopy={handleCopy}
              copiedIndex={copiedIndex}
              t={t}
            />
          ))
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

        <Reanimated.View style={styles.shareRow} entering={FadeInUp.delay(captions.length * 150 + 400).springify().damping(14)}>
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
        </Reanimated.View>
      </ScrollView>



      {/* "YAPAY ZEKA YAKITIN TÜKENDİ" LÜKS MODALI */}
      <Modal visible={showCreditModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={30}
            tint="systemThinMaterialLight"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.creditModalCard}>
            <View style={styles.creditIconWrapper}>
              <Ionicons name="battery-dead" size={32} color="#34C759" />
            </View>
            <Text style={styles.creditModalTitle}>
              {t("outOfCredits.title")}
            </Text>
            <Text style={styles.creditModalDesc}>
              {t("outOfCredits.descriptionCaption")}
            </Text>

            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={goToPaywall}
            >
              <LinearGradient
                colors={[...GlassTheme.gradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.purchaseGradient}
              >
                <Text style={styles.purchaseButtonText}>{t("outOfCredits.buyButton")}</Text>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'transparent',
  },
  safeArea: {
    backgroundColor: 'transparent',
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
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: GlassTheme.vibrantBorder,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
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
  creditBadgeHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: GlassTheme.textMain,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  creditBadgePremium: {
    color: "#FBBF24",
    textShadowColor: "rgba(251,191,36,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
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
    width: Dimensions.get("window").width * 0.85,
    borderRadius: GlassTheme.cardBorderRadius,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: GlassTheme.glassBorder,
  },
  cardInner: {
    padding: 24,
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
    marginTop: 16,
  },
  perImageCopyButton: {
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: GlassTheme.vibrantBorder,
    alignItems: "center",
    backgroundColor: GlassTheme.glassBg,
    marginTop: 24,
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
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  creditModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.2)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  creditIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.3)",
  },
  creditModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 12,
    textAlign: "center",
  },
  creditModalDesc: {
    fontSize: 14,
    color: "#8E8E93",
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
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "600",
  },
  perImageCard: {
    marginBottom: 24,
  },
  perImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: GlassTheme.panelStrong,
  },
  perImageLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#8E8E93",
    marginBottom: 12,
  },
  imageFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
});
