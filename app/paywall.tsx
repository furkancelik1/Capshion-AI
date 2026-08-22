import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePostHog } from "posthog-react-native";
import AmbientGlow from "@/components/AmbientGlow";
import HapticButton from "@/components/HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Yıllık",
  SIX_MONTH: "6 Ay",
  THREE_MONTH: "3 Ay",
  TWO_MONTH: "2 Ay",
  MONTHLY: "Aylık",
  WEEKLY: "Haftalık",
};

function packageLabel(pkg: PurchasesPackage): string {
  return PACKAGE_TYPE_LABELS[pkg.packageType] ?? "Paket";
}

function packagePeriod(pkg: PurchasesPackage): string {
  const pt = pkg.packageType;
  if (pt === "ANNUAL") return "12 ay boyunca sınırsız içerik üretimi";
  if (pt === "MONTHLY") return "Aylık sınırsız içerik üretimi";
  return "Sınırsız içerik üretimi";
}

export default function PaywallScreen() {
  const posthog = usePostHog();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const available = offerings.current?.availablePackages ?? [];
        setPackages(available);
        if (available.length > 0) {
          setSelectedPackage(available[0]);
        }
      } catch (err: any) {
        console.error("[Paywall] Teklifler alınamadı:", err?.message ?? err);
      } finally {
        setLoadingOfferings(false);
      }
    };

    loadOfferings();
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!selectedPackage || purchasing) return;

    try {
      setPurchasing(true);
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      if (typeof customerInfo.entitlements.active["premium"] !== "undefined") {
        posthog?.capture("premium_satin_alindi", {
          paket_tipi: selectedPackage.product.identifier,
          fiyat: selectedPackage.product.priceString,
        });
        router.back();
      }
    } catch (err: any) {
      if (!err?.userCancelled) {
        Alert.alert(
          "Satın Alma Başarısız",
          err?.message || "Satın alma işlemi tamamlanamadı, lütfen tekrar deneyin.",
        );
      }
    } finally {
      setPurchasing(false);
    }
  }, [selectedPackage, purchasing]);

  const handleRestore = useCallback(async () => {
    try {
      setRestoring(true);
      const customerInfo = await Purchases.restorePurchases();
      if (typeof customerInfo.entitlements.active["premium"] !== "undefined") {
        router.back();
      } else {
        Alert.alert(
          "Geri Yükleme Tamamlandı",
          "Geri yüklenebilir bir satın alma bulunamadı.",
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Geri Yükleme Başarısız",
        err?.message || "Satın almalarınız geri yüklenemedi.",
      );
    } finally {
      setRestoring(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={GlassTheme.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIconWrapper}>
              <Ionicons name="diamond" size={32} color="#0A84FF" />
            </View>
            <Text style={styles.heroTitle}>Premium'a Geç</Text>
            <Text style={styles.heroSubtitle}>
              Sınırsız AI içerik üretimi, tüm tonlar ve öncelikli hız.
            </Text>
          </View>

          {loadingOfferings ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0A84FF" />
              <Text style={styles.loadingText}>Paketler yükleniyor...</Text>
            </View>
          ) : packages.length === 0 ? (
            <View style={styles.loadingBox}>
              <Ionicons name="pricetag-outline" size={32} color="rgba(255,255,255,0.3)" />
              <Text style={styles.loadingText}>
                Şu anda satın alınabilecek paket bulunamadı.
              </Text>
            </View>
          ) : (
            <View style={styles.packageList}>
              {packages.map((pkg, index) => {
                const isSelected = selectedPackage?.identifier === pkg.identifier;
                const price = pkg.product?.priceString ?? "—";
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    activeOpacity={0.85}
                    onPress={() => setSelectedPackage(pkg)}
                    style={[
                      styles.packageCardWrap,
                      index < packages.length - 1 && styles.packageCardSpacing,
                    ]}
                  >
                    <BlurView
                      intensity={GlassTheme.blurIntensity}
                      tint="systemThinMaterialDark"
                      style={[
                        styles.packageCard,
                        isSelected && styles.packageCardSelected,
                      ]}
                    >
                      <View style={styles.packageInfo}>
                        <Text style={styles.packageLabel}>{packageLabel(pkg)}</Text>
                        <Text style={styles.packagePeriod}>{packagePeriod(pkg)}</Text>
                      </View>
                      <View style={styles.packagePriceWrap}>
                        <Text style={styles.packagePrice}>{price}</Text>
                        <View
                          style={[
                            styles.radio,
                            isSelected && styles.radioSelected,
                          ]}
                        >
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <HapticButton
            style={styles.buyButton}
            onPress={handlePurchase}
            activeOpacity={0.85}
            disabled={purchasing || !selectedPackage || loadingOfferings}
          >
            <LinearGradient
              colors={[...GlassTheme.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buyGradient}
            >
              {purchasing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#FFF" />
                  <Text style={styles.buyButtonText}>
                    {selectedPackage ? `Premium'a Geç` : "Satın Al"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </HapticButton>

          <HapticButton
            style={styles.restoreButton}
            onPress={handleRestore}
            activeOpacity={0.7}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={GlassTheme.textMuted} />
            ) : (
              <Text style={styles.restoreButtonText}>Satın Almayı Geri Yükle</Text>
            )}
          </HapticButton>

          <Text style={styles.disclaimer}>
            Ödeme, hesabınıza tanımlanır ve abonelik iptal edilene kadar otomatik
            yenilenir.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
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
    padding: 24,
    paddingBottom: 48,
  },
  hero: {
    alignItems: "center",
    marginBottom: 32,
  },
  heroIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(10, 132, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.3)",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: GlassTheme.textMain,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: GlassTheme.textMuted,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  loadingBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: GlassTheme.textMuted,
    textAlign: "center",
  },
  packageList: {
    marginBottom: 8,
  },
  packageCardWrap: {
    borderRadius: GlassTheme.cardBorderRadius,
    ...GlassTheme.cardShadow,
  },
  packageCardSpacing: {
    marginBottom: 14,
  },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: GlassTheme.cardBorderRadius,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: GlassTheme.glassBorder,
  },
  packageCardSelected: {
    borderColor: GlassTheme.selectedBorder,
    borderWidth: 1.5,
  },
  packageInfo: {
    flex: 1,
    paddingRight: 12,
  },
  packageLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: GlassTheme.textMain,
    marginBottom: 4,
  },
  packagePeriod: {
    fontSize: 13,
    color: GlassTheme.textMuted,
  },
  packagePriceWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: "800",
    color: GlassTheme.textMain,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: GlassTheme.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GlassTheme.primary,
  },
  buyButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 20,
    ...GlassTheme.cardShadow,
  },
  buyGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  restoreButton: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMuted,
    textDecorationLine: "underline",
  },
  disclaimer: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
});
