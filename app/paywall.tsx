import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases, { PACKAGE_TYPE, PRODUCT_CATEGORY, PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePostHog } from "posthog-react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import AmbientGlow from "@/components/AmbientGlow";
import HapticButton from "@/components/HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";
import { hasPremiumEntitlement } from "@/utils/revenueCat";
import { logAppEvent } from "@/utils/analytics";
import { api } from "@/services/api";

// Uygulamanın geri kalanıyla (login/profile) aynı açık iOS temasını kullanır —
// GlassTheme üzerine paywall'a özel birkaç tint eklenir.
const Luxe = {
  bg: GlassTheme.background,
  panel: GlassTheme.cardBackground,
  panelBorder: GlassTheme.border,
  accent: GlassTheme.primary,
  accentTint: "rgba(52, 199, 89, 0.1)",
  accentGradient: GlassTheme.primaryGradient,
  textMain: GlassTheme.textMain,
  textMuted: GlassTheme.textMuted,
  textFaint: "#C7C7CC",
};

const PRO_FEATURES = [
  "Aylık 50 kredi otomatik yüklenir",
  "Tüm premium tonlar (Viral, Lüks, Hikaye Anlatıcı)",
  "Serbest metin (custom prompt) ile üretim",
  "Karusel modu ve öncelikli işlem hızı",
];

function creditsInPackage(pkg: PurchasesPackage): number {
  const match = pkg.product.identifier.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// Kredi paketleri de RevenueCat panelinde CUSTOM packageType ile
// tanımlı olduğundan, packageType tek başına abonelik ile krediyi
// ayırt etmeye yetmiyor — eğer "Monthly" paketi panelde özel bir
// identifier ile tanımlandıysa o da CUSTOM görünür. Bunun yerine
// product.productCategory (SUBSCRIPTION vs NON_SUBSCRIPTION) esas
// alınır; bu alan App Store/Play Store'dan gelir ve paket adlandırma
// hatalarından etkilenmez.
function isSubscriptionPackage(pkg: PurchasesPackage): boolean {
  return pkg.product?.productCategory === PRODUCT_CATEGORY.SUBSCRIPTION;
}

// RevenueCat panelinde "Monthly" paketi farklı şekillerde tanımlanmış
// olabilir (standart packageType, ya da özel identifier). Sırayla dene:
// 1) packageType === MONTHLY (RC'nin standart aylık paket tipi)
// 2) identifier tam olarak "Monthly" (panelde özel/custom tanımlanmışsa)
// 3) abonelik ürünü olan (productCategory === SUBSCRIPTION) ilk paket (son çare)
function findMonthlySubscription(packages: PurchasesPackage[]): PurchasesPackage | null {
  const byType = packages.find((pkg) => pkg.packageType === PACKAGE_TYPE.MONTHLY);
  if (byType) return byType;

  const byIdentifier = packages.find(
    (pkg) => pkg.identifier.toLowerCase() === "monthly",
  );
  if (byIdentifier) return byIdentifier;

  return packages.find(isSubscriptionPackage) ?? null;
}

export default function PaywallScreen() {
  const posthog = usePostHog();
  const [subscriptionPkg, setSubscriptionPkg] = useState<PurchasesPackage | null>(null);
  const [creditPkgs, setCreditPkgs] = useState<PurchasesPackage[]>([]);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    logAppEvent("paywall_viewed");
  }, []);

  const refreshCredits = useCallback(() => {
    api.getProfile().then((data) => {
      if (data?.credits_remaining !== undefined) setCreditsRemaining(data.credits_remaining);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const available = offerings.current?.availablePackages ?? [];

        const subscription = findMonthlySubscription(available);
        const credits = available
          .filter((pkg) => !isSubscriptionPackage(pkg) && pkg.identifier !== subscription?.identifier)
          .sort((a, b) => creditsInPackage(a) - creditsInPackage(b));

        if (!subscription) {
          console.warn(
            "[Paywall] Aylık abonelik paketi bulunamadı. RevenueCat panelinde 'current' offering içinde packageType=MONTHLY veya identifier='Monthly' olan bir paket olduğundan emin olun.",
          );
        } else if (!subscription.product?.priceString) {
          console.warn(
            "[Paywall] Aylık paket bulundu ama fiyat bilgisi (priceString) eksik:",
            subscription.identifier,
          );
        }

        setSubscriptionPkg(subscription);
        setCreditPkgs(credits);
      } catch (err: any) {
        console.error("[Paywall] Teklifler alınamadı:", err?.message ?? err);
      } finally {
        setLoadingOfferings(false);
      }
    };

    loadOfferings();
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (!subscriptionPkg || purchasingId) return;

    try {
      setPurchasingId(subscriptionPkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(subscriptionPkg);
      if (hasPremiumEntitlement(customerInfo)) {
        posthog?.capture("premium_satin_alindi", {
          paket_tipi: subscriptionPkg.product.identifier,
          fiyat: subscriptionPkg.product.priceString,
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
      setPurchasingId(null);
    }
  }, [subscriptionPkg, purchasingId, posthog]);

  const handleBuyCredits = useCallback(async (pkg: PurchasesPackage) => {
    if (purchasingId) return;

    try {
      setPurchasingId(pkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      void customerInfo;
      posthog?.capture("kredi_satin_alindi", {
        paket: pkg.product.identifier,
        fiyat: pkg.product.priceString,
      });
      refreshCredits();
      Alert.alert("Başarılı!", "Krediler hesabına tanımlandı.");
    } catch (err: any) {
      if (!err?.userCancelled) {
        Alert.alert(
          "Satın Alma Başarısız",
          err?.message || "Satın alma işlemi tamamlanamadı, lütfen tekrar deneyin.",
        );
      }
    } finally {
      setPurchasingId(null);
    }
  }, [purchasingId, posthog, refreshCredits]);

  const handleRestore = useCallback(async () => {
    try {
      setRestoring(true);
      const customerInfo = await Purchases.restorePurchases();
      if (hasPremiumEntitlement(customerInfo)) {
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

  const subscriptionPriceLabel = useMemo(
    () => subscriptionPkg?.product?.priceString ?? "—",
    [subscriptionPkg],
  );

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={Luxe.textMain} />
          </TouchableOpacity>
          <View style={styles.headerCreditPill}>
            <Ionicons name="flash" size={13} color={Luxe.accent} />
            <Text style={styles.headerCreditText}>
              {creditsRemaining === null ? "—" : creditsRemaining}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
            <Text style={styles.heroEyebrow}>CAPSHION PRO</Text>
            <Text style={styles.heroTitle}>Daha fazla üretim,{"\n"}daha az beklemek</Text>
          </Animated.View>

          {/* ── Ana Odak: Capshion Pro Aboneliği ── */}
          <Animated.View entering={FadeInDown.duration(450).delay(60)} style={styles.proCard}>
            <View style={styles.proBadge}>
              <Ionicons name="diamond" size={13} color={Luxe.accent} />
              <Text style={styles.proBadgeText}>EN AVANTAJLI</Text>
            </View>

            <Text style={styles.proTitle}>Capshion Pro</Text>
            <View style={styles.proPriceRow}>
              <Text style={styles.proPrice}>
                {loadingOfferings ? "…" : subscriptionPriceLabel}
              </Text>
              <Text style={styles.proPricePeriod}>/ ay</Text>
            </View>

            <View style={styles.proFeatureList}>
              {PRO_FEATURES.map((feature) => (
                <View key={feature} style={styles.proFeatureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Luxe.accent} />
                  <Text style={styles.proFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <HapticButton
              style={styles.proButton}
              onPress={handleSubscribe}
              activeOpacity={0.9}
              disabled={!subscriptionPkg || purchasingId !== null || loadingOfferings}
            >
              <LinearGradient
                colors={Luxe.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.proButtonGradient}
              >
                {purchasingId === subscriptionPkg?.identifier ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={17} color="#FFFFFF" />
                    <Text style={styles.proButtonText}>Pro'ya Geç</Text>
                  </>
                )}
              </LinearGradient>
            </HapticButton>
          </Animated.View>

          {/* ── Kredi Takviyesi ── */}
          <Text style={styles.sectionLabel}>Kredi Takviyesi</Text>
          <Text style={styles.sectionSubLabel}>
            Abonelik olmadan tek seferlik kredi satın al.
          </Text>

          {loadingOfferings ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Luxe.textMuted} />
            </View>
          ) : creditPkgs.length === 0 ? (
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>Şu anda kredi paketi bulunamadı.</Text>
            </View>
          ) : (
            <View style={styles.creditRow}>
              {creditPkgs.map((pkg, index) => {
                const credits = creditsInPackage(pkg);
                const isPopular = index === Math.floor(creditPkgs.length / 2);
                const isBusy = purchasingId === pkg.identifier;

                return (
                  <Animated.View
                    key={pkg.identifier}
                    entering={FadeInDown.duration(350).delay(120 + index * 60)}
                    style={styles.creditCardWrap}
                  >
                    <HapticButton
                      style={[
                        styles.creditCard,
                        isPopular && styles.creditCardPopular,
                      ]}
                      onPress={() => handleBuyCredits(pkg)}
                      disabled={purchasingId !== null}
                      activeOpacity={0.9}
                    >
                      {isPopular && (
                        <View style={styles.creditPopularTag}>
                          <Text style={styles.creditPopularTagText}>POPÜLER</Text>
                        </View>
                      )}
                      {isBusy ? (
                        <ActivityIndicator color={Luxe.textMain} />
                      ) : (
                        <>
                          <Text style={styles.creditCardAmount}>{credits}</Text>
                          <Text style={styles.creditCardUnit}>kredi</Text>
                          <View style={styles.creditCardDivider} />
                          <Text style={styles.creditCardPrice}>
                            {pkg.product?.priceString ?? "—"}
                          </Text>
                        </>
                      )}
                    </HapticButton>
                  </Animated.View>
                );
              })}
            </View>
          )}

          <HapticButton
            style={styles.restoreButton}
            onPress={handleRestore}
            activeOpacity={0.7}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator size="small" color={Luxe.textMuted} />
            ) : (
              <Text style={styles.restoreButtonText}>Satın Almayı Geri Yükle</Text>
            )}
          </HapticButton>

          <Text style={styles.disclaimer}>
            Abonelik, iptal edilene kadar otomatik yenilenir. Kredi paketleri tek
            seferliktir ve süresi dolmaz.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Luxe.bg,
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
    height: 56,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCreditPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Luxe.panel,
    borderWidth: 1,
    borderColor: Luxe.panelBorder,
  },
  headerCreditText: {
    fontSize: 13,
    fontWeight: "700",
    color: Luxe.textMain,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  hero: {
    marginBottom: 24,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: Luxe.accent,
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Luxe.textMain,
    lineHeight: 32,
  },
  proCard: {
    borderRadius: 24,
    backgroundColor: Luxe.panel,
    padding: 22,
    ...GlassTheme.cardShadow,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Luxe.accentTint,
    marginBottom: 14,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Luxe.accent,
    letterSpacing: 1,
  },
  proTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: Luxe.textMain,
    marginBottom: 6,
  },
  proPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    marginBottom: 18,
  },
  proPrice: {
    fontSize: 28,
    fontWeight: "800",
    color: Luxe.textMain,
  },
  proPricePeriod: {
    fontSize: 14,
    fontWeight: "600",
    color: Luxe.textMuted,
    marginBottom: 4,
  },
  proFeatureList: {
    gap: 11,
    marginBottom: 22,
  },
  proFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  proFeatureText: {
    flex: 1,
    fontSize: 13.5,
    color: Luxe.textMuted,
    lineHeight: 19,
  },
  proButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  proButtonGradient: {
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  proButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Luxe.textMain,
    marginTop: 30,
    marginBottom: 4,
  },
  sectionSubLabel: {
    fontSize: 12.5,
    color: Luxe.textMuted,
    marginBottom: 14,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    color: Luxe.textMuted,
  },
  creditRow: {
    flexDirection: "row",
    gap: 10,
  },
  creditCardWrap: {
    flex: 1,
  },
  creditCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Luxe.panelBorder,
    backgroundColor: Luxe.panel,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: "center",
    minHeight: 108,
    justifyContent: "center",
    ...GlassTheme.cardShadow,
    shadowOpacity: 0.05,
  },
  creditCardPopular: {
    borderColor: Luxe.accent,
    borderWidth: 1.5,
  },
  creditPopularTag: {
    position: "absolute",
    top: -9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Luxe.accent,
  },
  creditPopularTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  creditCardAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: Luxe.textMain,
  },
  creditCardUnit: {
    fontSize: 11,
    color: Luxe.textMuted,
    marginTop: 1,
    marginBottom: 10,
  },
  creditCardDivider: {
    width: 24,
    height: 1,
    backgroundColor: Luxe.panelBorder,
    marginBottom: 10,
  },
  creditCardPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: Luxe.textMuted,
  },
  restoreButton: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  restoreButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Luxe.textMuted,
    textDecorationLine: "underline",
  },
  disclaimer: {
    fontSize: 11.5,
    color: Luxe.textFaint,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 17,
  },
});
