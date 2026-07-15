import HapticButton from "@/components/HapticButton";
import LiquidToast from "@/components/LiquidToast";
import { GlassTheme } from "@/constants/LiquidGlass";
import type { CaptionItem } from "@/hooks/useGenerateCaption";
import { supabase } from "@/services/supabase";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface DetailScreenData {
  captions: CaptionItem[];
  image_url: string;
  image_urls?: string[]; // ÇOKLU GÖRSEL DESTEĞİ
  credits_remaining: number;
}

function GlassCard({
  caption,
  index,
  onCopy,
  copiedIndex,
}: {
  caption: CaptionItem;
  index: number;
  onCopy: (text: string, index: number) => void;
  copiedIndex: number | null;
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
    <Animated.View
      entering={FadeInUp.delay(index * 120)
        .springify()
        .damping(14)}
    >
      <Animated.View style={[animatedStyle, styles.cardShadow]}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.cardBlur}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardLabel}>Alternatif {index + 1}</Text>

              <Text style={styles.cardText}>{caption.text}</Text>

              {caption.hashtags.length > 0 && (
                <View style={styles.hashtagRow}>
                  {caption.hashtags.map((tag, tagIndex) => (
                    <View key={tagIndex} style={styles.hashtag}>
                      <Text style={styles.hashtagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <HapticButton
                style={styles.copyButton}
                onPress={() => onCopy(caption.text, index)}
                activeOpacity={0.7}
              >
                <Text style={styles.copyButtonText}>
                  {copiedIndex === index ? "Kopyalandı ✅" : "Kopyala 📋"}
                </Text>
              </HapticButton>
            </View>
          </BlurView>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default function CaptionDetailScreen() {
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
    inlineData?.captions ?? [],
  );

  // 🚀 TEK URL YERİNE DİZİ KULLANIYORUZ (Geriye dönük uyumluluk için tek url varsa diziye sarılır)
  const [imageUrls, setImageUrls] = useState<string[]>(
    inlineData?.image_urls ??
      (inlineData?.image_url ? [inlineData.image_url] : []),
  );

  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(
    inlineData?.credits_remaining ?? null,
  );
  const [loading, setLoading] = useState(!inlineData);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (inlineData) return;

    const fetchData = async () => {
      setLoading(true);

      // Not: Veritabanında image_urls sütunu yoksa, fallback olarak image_url çekilir.
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
        .select("text, hashtags")
        .eq("post_id", id)
        .order("id");

      if (captionRows) {
        setCaptions(captionRows as CaptionItem[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [id, inlineData]);

  const handleCopy = useCallback(async (text: string, index: number) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedIndex(index);
      setToastVisible(true);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      Alert.alert("Hata", "Panoya kopyalanamadı.");
    }
  }, []);

  const handleShare = useCallback(() => {
    Alert.alert(
      "Instagram Paylaşımı",
      "Yakında Instagram doğrudan paylaşım özelliği eklenecek!",
    );
  }, []);

  const renderGradient = () => (
    <LinearGradient
      colors={[...GlassTheme.primaryGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {renderGradient()}
        <ActivityIndicator size="large" color={GlassTheme.textMain} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderGradient()}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // 🚀 DIKEY SCROLL YAVAŞLATMA PARAMETRELERİ
        decelerationRate={0.99}
        bounces={true}
      >
        {/* ── Photo Dump Carousel ── */}
        {imageUrls.length > 0 && (
          <Animated.View
            entering={FadeInUp.springify().damping(14)}
            style={styles.imageSection}
          >
            <View style={styles.imageCarouselWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageCarousel}
                // 🚀 PREMIUM VE YUMUŞAK KAYDIRMA PARAMETRELERİ
                decelerationRate="normal" // 1.4"
                snapToInterval={132} // Genişlik (120) + Gap (12)
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
                    <Image source={{ uri }} style={styles.previewImage} />
                  </BlurView>
                ))}
              </ScrollView>
            </View>

            {creditsRemaining !== null && (
              <Text style={styles.creditBadge}>
                Kalan kredi: {creditsRemaining}
              </Text>
            )}
          </Animated.View>
        )}

        <Animated.Text
          entering={FadeInUp.springify().damping(14)}
          style={styles.sectionTitle}
        >
          Oluşturulan Açıklamalar
        </Animated.Text>

        {captions.length === 0 ? (
          <BlurView
            intensity={GlassTheme.blurIntensity}
            tint="dark"
            style={styles.emptyCard}
          >
            <Text style={styles.emptyText}>Henüz açıklama bulunamadı.</Text>
          </BlurView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardsRow}
          >
            {captions.map((caption, index) => (
              <GlassCard
                key={index}
                caption={caption}
                index={index}
                onCopy={handleCopy}
                copiedIndex={copiedIndex}
              />
            ))}
          </ScrollView>
        )}

        <HapticButton
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[...GlassTheme.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shareGradient}
          >
            <Text style={styles.shareButtonText}>Instagram'da Paylaş 🚀</Text>
          </LinearGradient>
        </HapticButton>
      </ScrollView>

      <LiquidToast
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },

  /* ── Image Carousel Styles ── */
  imageSection: {
    marginBottom: 24,
    marginTop: 8,
  },
  imageCarouselWrapper: {
    // Sayfanın genel padding değerini (20) kırarak karuselin ekran dışına kadar kaymasını sağlar
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
  },
  creditBadge: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 10,
    color: GlassTheme.textSub,
    textAlign: "center",
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
    backgroundColor: GlassTheme.glassCardBg,
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
  shareButton: {
    marginTop: 28,
    borderRadius: 16,
    overflow: "hidden",
    ...GlassTheme.cardShadow,
  },
  shareGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: GlassTheme.textMain,
  },
});
