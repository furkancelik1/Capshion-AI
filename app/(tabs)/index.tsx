import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AmbientGlow from "../../components/AmbientGlow";
import CameraWidget from "../../components/CameraWidget";
import {
  FeedIcon,
  HashtagIcon,
  SparkleIcon,
  ToneIcon,
} from "../../components/GlassIcons";
import GlassPanel from "../../components/GlassPanel";
import HapticButton from "../../components/HapticButton";
import LiquidLoading from "../../components/LiquidLoading";
import ToneSelector from "../../components/ToneSelector";
import { GlassTheme } from "../../constants/LiquidGlass";
import { useGenerateCaption } from "../../hooks/useGenerateCaption";

const STATS_DATA = [
  { value: "12K+", label: "caption üretildi" },
  { value: "%94", label: "etkileşim artışı" },
  { value: "3 sn", label: "ortalama üretim" },
] as const;

const FEATURES_DATA = [
  {
    icon: "tone" as const,
    title: "Ton eşleştirme",
    text: "Marka sesini yakalar; eğlenceli, sade ya da premium tonda caption önerileri sunar.",
  },
  {
    icon: "hashtag" as const,
    title: "Hashtag zekâsı",
    text: "İçeriğe uygun niş ve trend etiketleri dengeleyerek keşfete çıkma şansını artırır.",
  },
  {
    icon: "feed" as const,
    title: "Hızlı yayın akışı",
    text: "Tek dokunuşla kopyala, planla ve yayınla. İçerik üretiminden paylaşıma geçişi hızlandırır.",
  },
] as const;

const SAMPLE_PROMPT =
  "Yeni ürün lansmanı için modern ve enerjik bir caption yaz.";
const SAMPLE_OUTPUT =
  "✨ Yeni koleksiyon yayında! Stilini bir üst seviyeye taşı, farkını feed'de hissettir. #newdrop #styleinspo";

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
  // 🚀 TEK GÖRSEL YERİNE ÇOKLU GÖRSEL STATE'İ KULLANIYORUZ
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);

  const { generate, loading, error } = useGenerateCaption();

  const handleCreateCapshion = async () => {
    if (selectedImages.length === 0 || !selectedTone) {
      Alert.alert(
        "Eksik Bilgi",
        "Lütfen en az bir fotoğraf seçin ve bir ton belirleyin.",
      );
      return;
    }

    // Artık seçilen tüm görsellerin (URL'lerin) dizisini gönderiyoruz
    const result = await generate(selectedImages, selectedTone);

    if (result) {
      router.push({
        pathname: "/caption/[id]",
        params: {
          id: result.post_id,
          data: JSON.stringify({
            captions: result.captions,
            image_url: result.image_urls?.[0] || result.image_url,
            image_urls: result.image_urls, // Tüm diziyi de gönderiyoruz
            credits_remaining: result.credits_remaining,
          }),
        },
      });
      // Başarılı işlem sonrası state'leri sıfırla
      setSelectedImages([]);
      setSelectedTone(null);
    } else if (error) {
      Alert.alert("Hata", error);
    }
  };

  const handleHowItWorks = () => {
    Alert.alert(
      "Nasıl Çalışır?",
      "1. Fotoğraflarını seç (Photo Dump)\n2. Gönderi tonunu belirle\n3. Yapay zeka ortak caption'ı oluştursun\n4. Kopyala ve paylaş!",
    );
  };

  // En az bir görsel ve bir ton seçildiyse buton aktif olur
  const canGenerate = selectedImages.length > 0 && selectedTone;

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        scrollEnabled={!loading}
      >
        {/* ── Top Nav ── */}
        <GlassPanel style={styles.topNav}>
          <View style={styles.brandRow}>
            <SparkleIcon size={20} />
            <Text style={styles.brandText}>CapshionAI</Text>
          </View>
          <GlassPanel style={styles.betaPill}>
            <Text style={styles.betaText}>Beta erişim</Text>
          </GlassPanel>
        </GlassPanel>

        {/* ── Hero ── */}
        <View style={styles.section}>
          <GlassPanel style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              Premium Instagram caption generator
            </Text>
          </GlassPanel>

          <Text style={styles.heroTitle}>
            Paylaşmadan önce{"\n"}caption'ını parlat.
          </Text>
          <Text style={styles.heroSubtitle}>
            CapshionAI ile gönderine en uygun metni saniyeler içinde üret; daha
            güçlü etkileşim, daha tutarlı marka dili.
          </Text>

          <View style={styles.heroActions}>
            <HapticButton
              style={[
                styles.primaryButton,
                !canGenerate && styles.primaryButtonMuted,
              ]}
              onPress={handleCreateCapshion}
              activeOpacity={0.85}
              disabled={!canGenerate}
            >
              <Text style={styles.primaryButtonText}>Caption Üret</Text>
            </HapticButton>
            <HapticButton
              style={styles.secondaryButton}
              onPress={handleHowItWorks}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Nasıl çalışır?</Text>
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
              <Text style={styles.previewHeadText}>AI Caption Studio</Text>
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
            <Text style={styles.sectionTitle}>Gönderi Tonunu Seç</Text>
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
          <Text style={styles.closingTitle}>
            Bir sonraki post için{"\n"}caption hazır mı?
          </Text>
          <Text style={styles.closingText}>
            CapshionAI ile fikri metne dönüştür, paylaşım ritmini hiç düşürme.
          </Text>
          <HapticButton
            style={styles.primaryButton}
            onPress={handleCreateCapshion}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Ücretsiz dene</Text>
          </HapticButton>
        </GlassPanel>
      </ScrollView>

      {loading && <LiquidLoading />}
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
    opacity: 0.4,
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
});
