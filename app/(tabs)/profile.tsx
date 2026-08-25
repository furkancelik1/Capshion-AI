import AgeRangeSelector from "@/components/AgeRangeSelector";
import AmbientGlow from "@/components/AmbientGlow";
import FeedbackModal from "@/components/FeedbackModal";
import { LogOutIcon } from "@/components/GlassIcons";
import GlassPanel from "@/components/GlassPanel";
import HapticButton from "@/components/HapticButton";
import { GlassTheme } from "@/constants/LiquidGlass";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { hasPremiumEntitlement } from "@/utils/revenueCat";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases from "react-native-purchases";

interface UserProfile {
  email: string;
  credits_remaining: number;
  age_range: string | null;
  is_premium: boolean;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function RowItem({
  icon,
  label,
  value,
  onPress,
  tint,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  tint?: string;
  destructive?: boolean;
}) {
  const Container = onPress ? HapticButton : View;

  return (
    <Container style={styles.row} onPress={onPress} activeOpacity={0.5}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: tint || "rgba(52,199,89,0.15)" },
        ]}
      >
        <Ionicons name={icon} size={18} color={GlassTheme.primary} />
      </View>
      <Text style={[styles.rowLabel, destructive && { color: "#FF3B30" }]}>
        {label}
      </Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && !destructive && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color="#C7C7CC"
        />
      )}
    </Container>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingAge, setEditingAge] = useState(false);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // RevenueCat States
  const [isPremium, setIsPremium] = useState(false);
  const [rcPackages, setRcPackages] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const initRevenueCat = async () => {
      try {
        // 1. Kullanıcı premium mu kontrolü
        const customerInfo = await Purchases.getCustomerInfo();
        if (mounted) {
          setIsPremium(hasPremiumEntitlement(customerInfo));
        }

        // 2. Kredi paketlerini (default teklifini) çekme
        const offerings = await Purchases.getOfferings();
        if (mounted && offerings.current !== null) {
          // default içindeki paketleri arayüze basmak için state'e atıyoruz
          setRcPackages(offerings.current.availablePackages);
        }
      } catch (err: any) {
        console.error(
          "[Profile] RevenueCat verileri alınamadı:",
          err?.message ?? err,
        );
      }
    };
    initRevenueCat();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      if (!user) return;
      setLoadingProfile(true);
      const data = await api.getProfile();
      if (data) {
        setProfile(data);
        setAgeRange(data.age_range);
      }
    } catch {
      console.log("Profil yüklenirken hata");
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveAgeRange = async () => {
    if (!user || !ageRange) return;
    try {
      await api.updateAgeRange(ageRange);
      setEditingAge(false);
      setProfile((prev) => (prev ? { ...prev, age_range: ageRange } : prev));
    } catch {
      Alert.alert("Hata", "Yaş aralığı güncellenemedi.");
    }
  };

  const handleSignOut = () => {
    Alert.alert(t("profile.signOut"), t("profile.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.yes"), style: "destructive", onPress: signOut },
    ]);
  };

  // Google Play Satın Alma Tetikleyicisi
  const handlePurchase = async (pack: any) => {
    try {
      // 1. Google Play penceresini açar ve ödemeyi bekler
      const { customerInfo } = await Purchases.purchasePackage(pack);

      // 2. Başarılı olursa kullanıcıya bilgi ver
      Alert.alert(
        "Başarılı!",
        "Satın alma işlemi tamamlandı, kredilerin yükleniyor.",
      );

      // 3. Backend'den güncel kredi miktarını çekmek için profili yenile
      fetchProfile();
    } catch (e: any) {
      // Kullanıcı kendi isteğiyle pencereyi kapatmadıysa hatayı göster
      if (!e.userCancelled) {
        Alert.alert("Satın Alma Hatası", e.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <AmbientGlow />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>
                {profile?.email ? profile.email[0].toUpperCase() : "C"}
              </Text>
            </View>
          </View>
          <Text style={styles.emailText}>{profile?.email || user?.email}</Text>
        </View>

        {/* ── Premium Durumu ── */}
        <BlurView
          intensity={50}
          tint="systemThinMaterialLight"
          style={styles.premiumCard}
        >
          {isPremium ? (
            <View style={styles.premiumBadgeRow}>
              <Ionicons name="diamond" size={18} color="#FBBF24" />
              <Text style={styles.premiumBadgeText}>👑 Premium Üye</Text>
            </View>
          ) : (
            <HapticButton
              style={styles.upgradeButton}
              onPress={() => router.push("/paywall")}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[...GlassTheme.gradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeGradient}
              >
                <Ionicons name="diamond" size={16} color="#FFF" />
                <Text style={styles.upgradeText}>Premium'a Yükselt</Text>
              </LinearGradient>
            </HapticButton>
          )}
        </BlurView>

        {/* ── Section: Hesap ── */}
        <SectionHeader title={t("profile.balance")} />

        <BlurView
          intensity={50}
          tint="systemThinMaterialLight"
          style={styles.section}
        >
          {loadingProfile ? (
            <RowItem
              icon="wallet-outline"
              label={t("profile.credits")}
              value="..."
            />
          ) : (
            <>
              <RowItem
                icon="wallet-outline"
                label={t("profile.credits")}
                value={
                  profile?.is_premium
                    ? "♾️"
                    : `${profile?.credits_remaining ?? 0}`
                }
              />
              <Separator />
              <RowItem
                icon="person-outline"
                label={t("profile.ageRange")}
                value={profile?.age_range || t("profile.ageNotSet")}
                onPress={() => setEditingAge(true)}
              />
            </>
          )}
        </BlurView>

        {/* ── Yaş Düzenleme ── */}
        {editingAge && (
          <GlassPanel style={styles.agePanel}>
            <AgeRangeSelector value={ageRange} onChange={setAgeRange} />
            <View style={styles.ageActions}>
              <HapticButton
                style={styles.ageSaveBtn}
                onPress={handleSaveAgeRange}
              >
                <Text style={styles.ageSaveText}>{t("common.save")}</Text>
              </HapticButton>
              <HapticButton
                style={styles.ageCancelBtn}
                onPress={() => {
                  setEditingAge(false);
                  setAgeRange(profile?.age_range || null);
                }}
              >
                <Text style={styles.ageCancelText}>{t("common.cancel")}</Text>
              </HapticButton>
            </View>
          </GlassPanel>
        )}

        {/* ── Kredi Paketleri (RevenueCat'ten Dinamik Gelecek) ── */}
        <SectionHeader title={t("profile.topUp")} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.packagesRow}
        >
          {rcPackages.length === 0 ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator color={GlassTheme.primary} />
            </View>
          ) : (
            rcPackages.map((pkg) => {
              // Ürün kimliğinden (örn: "30_credits") rakamı otomatik ayıkla
              const match = pkg.product.identifier.match(/\d+/);
              const credits = match ? parseInt(match[0], 10) : 0;
              const isPopular = credits === 30; // 30 kredilik olanı popüler stilinde göster

              return (
                <HapticButton
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isPopular && styles.packageCardPopular,
                  ]}
                  onPress={() => handlePurchase(pkg)}
                >
                  <Text style={styles.packageCredits}>{credits || "💎"}</Text>
                  <Text style={styles.packageLabel}>
                    {t("profile.credits")}
                  </Text>
                  <View style={styles.packageDivider} />

                  {/* Google Play'den dönen yerel fiyatı doğrudan buraya basıyoruz */}
                  <Text style={styles.packagePrice}>
                    {pkg.product.priceString}
                  </Text>
                </HapticButton>
              );
            })
          )}
        </ScrollView>

        {/* ── Section: Uygulama ── */}
        <SectionHeader title={t("profile.language")} />

        <BlurView
          intensity={50}
          tint="systemThinMaterialLight"
          style={styles.section}
        >
          <View style={styles.langRowItem}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: "rgba(52,199,89,0.15)" },
              ]}
            >
              <Ionicons
                name="language-outline"
                size={18}
                color={GlassTheme.primary}
              />
            </View>
            <Text style={styles.rowLabel}>{t("profile.language")}</Text>
            <View style={styles.langInlineToggle}>
              <TouchableOpacity
                style={[
                  styles.langChip,
                  i18n.language?.startsWith("tr") && styles.langChipActive,
                ]}
                onPress={() => i18n.changeLanguage("tr")}
              >
                <Text
                  style={[
                    styles.langChipText,
                    i18n.language?.startsWith("tr") &&
                      styles.langChipTextActive,
                  ]}
                >
                  TR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.langChip,
                  i18n.language?.startsWith("en") && styles.langChipActive,
                ]}
                onPress={() => i18n.changeLanguage("en")}
              >
                <Text
                  style={[
                    styles.langChipText,
                    i18n.language?.startsWith("en") &&
                      styles.langChipTextActive,
                  ]}
                >
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Separator />
          <RowItem
            icon="chatbubble-ellipses-outline"
            label={t("profile.feedback")}
            onPress={() => setShowFeedback(true)}
          />
        </BlurView>

        {/* ── Section: Çıkış ── */}
        <View style={styles.signOutSection}>
          <BlurView
            intensity={50}
            tint="systemThinMaterialLight"
            style={styles.section}
          >
            <HapticButton style={styles.signOutRow} onPress={handleSignOut}>
              <LogOutIcon size={18} />
              <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
            </HapticButton>
          </BlurView>
        </View>
      </ScrollView>

      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        userId={user?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingTop: 100,
    paddingBottom: 120,
    paddingHorizontal: 16,
  },

  /* ── Header ── */
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 28,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: GlassTheme.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: "rgba(52,199,89,0.12)",
  },
  avatarInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: GlassTheme.textMain,
    fontSize: 28,
    fontWeight: "700",
  },
  emailText: {
    fontSize: 16,
    fontWeight: "700",
    color: GlassTheme.neonPlatinum,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  /* ── Premium ── */
  premiumCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
    padding: 14,
    marginTop: 4,
  },
  premiumBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
  },
  premiumBadgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
  upgradeButton: {
    borderRadius: 16,
    overflow: "hidden",
    ...GlassTheme.cardShadow,
  },
  upgradeGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  upgradeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  /* ── Inset Grouped Section ── */
  sectionHeader: {
    paddingHorizontal: 4,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  section: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  separator: {
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginLeft: 52,
  },

  /* ── Row Items ── */
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: GlassTheme.textMain,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "400",
    color: "#8E8E93",
  },

  /* ── Age Edit Panel ── */
  agePanel: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    marginTop: 12,
  },
  ageActions: {
    flexDirection: "row",
    gap: 10,
  },
  ageSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: GlassTheme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ageSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  ageCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  ageCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },

  /* ── Packages ── */
  packagesRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 4,
  },
  packageCard: {
    width: 120,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 4,
  },
  packageCardPopular: {
    borderColor: GlassTheme.primary,
    borderWidth: 1,
  },
  packageCredits: {
    fontSize: 26,
    fontWeight: "800",
    color: GlassTheme.textMain,
    letterSpacing: 1,
  },
  packageLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: GlassTheme.textMuted,
  },
  packageDivider: {
    width: 28,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: 4,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: GlassTheme.primary,
    letterSpacing: 0.5,
  },

  /* ── Language ── */
  langRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 14,
  },
  langInlineToggle: {
    flexDirection: "row",
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#FFFFFF",
  },
  langChipActive: {
    borderColor: GlassTheme.primary,
    backgroundColor: "rgba(52,199,89,0.12)",
  },
  langChipText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: GlassTheme.textMuted,
  },
  langChipTextActive: {
    color: GlassTheme.primary,
  },

  /* ── Sign Out ── */
  signOutSection: {
    marginTop: 28,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,59,48,0.3)",
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF3B30",
  },
});
