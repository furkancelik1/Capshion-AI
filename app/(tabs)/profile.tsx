import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { usePayment } from "@/hooks/usePayment";
import { api } from "@/services/api";
import { GlassTheme } from "@/constants/LiquidGlass";
import AmbientGlow from "@/components/AmbientGlow";
import GlassPanel from "@/components/GlassPanel";
import HapticButton from "@/components/HapticButton";
import AgeRangeSelector from "@/components/AgeRangeSelector";
import FeedbackModal from "@/components/FeedbackModal";
import PaymentWebViewModal from "@/components/PaymentWebViewModal";
import { LogOutIcon } from "@/components/GlassIcons";

interface UserProfile {
  email: string;
  credits_remaining: number;
  age_range: string | null;
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
    <Container
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.5}
    >
      <View style={[styles.iconWrap, { backgroundColor: tint || "rgba(139,92,246,0.2)" }]}>
        <Ionicons name={icon} size={18} color={GlassTheme.primary} />
      </View>
      <Text style={[styles.rowLabel, destructive && { color: "#FF3B30" }]}>
        {label}
      </Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && !destructive && (
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
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

  const pay = usePayment(fetchProfile);

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
    Alert.alert(
      t("profile.signOut"),
      t("profile.signOutConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.yes"), style: "destructive", onPress: signOut },
      ],
    );
  };

  const initiatePayment = async (credits: number, price: string) => {
    const currency = i18n.language?.startsWith("tr") ? "TRY" : "USD";
    try {
      await pay.initiatePayment(price, credits, currency);
    } catch {
      Alert.alert(t("common.error"), t("outOfCredits.paymentFailureDesc"));
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
                {profile?.email
                  ? profile.email[0].toUpperCase()
                  : "C"}
              </Text>
            </View>
          </View>
          <Text style={styles.emailText}>
            {profile?.email || user?.email}
          </Text>
        </View>

        {/* ── Section: Hesap ── */}
        <SectionHeader title={t("profile.balance")} />

        <BlurView
          intensity={50}
          tint="systemThinMaterialDark"
          style={styles.section}
        >
          {loadingProfile ? (
            <RowItem icon="wallet-outline" label={t("profile.credits")} value="..." />
          ) : (
            <>
              <RowItem
                icon="wallet-outline"
                label={t("profile.credits")}
                value={`${profile?.credits_remaining ?? 0}`}
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

        {/* ── Yaş Düzenleme (editingAge açıkken) ── */}
        {editingAge && (
          <GlassPanel style={styles.agePanel}>
            <AgeRangeSelector value={ageRange} onChange={setAgeRange} />
            <View style={styles.ageActions}>
              <HapticButton style={styles.ageSaveBtn} onPress={handleSaveAgeRange}>
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

        {/* ── Kredi Paketleri ── */}
        <SectionHeader title={t("profile.topUp")} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.packagesRow}
        >
          {[
            { credits: 10, priceTr: "₺50", priceEn: "$2.99", amtTr: "50.0", amtEn: "2.99" },
            { credits: 30, priceTr: "₺120", priceEn: "$6.99", amtTr: "120.0", amtEn: "6.99" },
            { credits: 50, priceTr: "₺200", priceEn: "$11.99", amtTr: "200.0", amtEn: "11.99" },
          ].map((pkg) => {
            const isPopular = pkg.credits === 30;
            return (
              <HapticButton
                key={pkg.credits}
                style={[styles.packageCard, isPopular && styles.packageCardPopular]}
                onPress={() =>
                  initiatePayment(
                    pkg.credits,
                    i18n.language?.startsWith("tr") ? pkg.amtTr : pkg.amtEn,
                  )
                }
              >
                <Text style={styles.packageCredits}>{pkg.credits}</Text>
                <Text style={styles.packageLabel}>{t("profile.credits")}</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>
                  {i18n.language?.startsWith("tr") ? pkg.priceTr : pkg.priceEn}
                </Text>
              </HapticButton>
            );
          })}
        </ScrollView>

        {/* ── Section: Uygulama ── */}
        <SectionHeader title={t("profile.language")} />

        <BlurView
          intensity={50}
          tint="systemThinMaterialDark"
          style={styles.section}
        >
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[
                styles.langBtn,
                i18n.language?.startsWith("tr")
                  ? styles.langBtnActive
                  : styles.langBtnInactive,
              ]}
              onPress={() => i18n.changeLanguage("tr")}
            >
              <Text
                style={[
                  styles.langBtnText,
                  i18n.language?.startsWith("tr")
                    ? styles.langBtnTextActive
                    : styles.langBtnTextInactive,
                ]}
              >
                TR
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langBtn,
                i18n.language?.startsWith("en")
                  ? styles.langBtnActive
                  : styles.langBtnInactive,
              ]}
              onPress={() => i18n.changeLanguage("en")}
            >
              <Text
                style={[
                  styles.langBtnText,
                  i18n.language?.startsWith("en")
                    ? styles.langBtnTextActive
                    : styles.langBtnTextInactive,
                ]}
              >
                EN
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* ── Section: Destek ── */}
        <SectionHeader title={t("profile.feedback")} />

        <BlurView
          intensity={50}
          tint="systemThinMaterialDark"
          style={styles.section}
        >
          <RowItem
            icon="chatbubble-ellipses-outline"
            label={t("profile.feedback")}
            onPress={() => setShowFeedback(true)}
          />
        </BlurView>

        {/* ── Section: Çıkış ── */}
        <View style={styles.signOutSection}>
          <HapticButton style={styles.signOutRow} onPress={handleSignOut}>
            <LogOutIcon size={18} />
            <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
          </HapticButton>
        </View>
      </ScrollView>

      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        userId={user?.id}
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
  container: {
    flex: 1,
    backgroundColor: GlassTheme.background,
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
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  avatarInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.06)",
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
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  separator: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.08)",
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
    color: "rgba(255,255,255,0.4)",
  },

  /* ── Age Edit Panel ── */
  agePanel: {
    padding: 16,
    gap: 12,
    borderRadius: 20,
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
    borderColor: "rgba(255,255,255,0.15)",
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
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
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
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 4,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: GlassTheme.primary,
    letterSpacing: 0.5,
  },

  /* ── Language ── */
  langRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingBottom: 16,
  },
  langBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  langBtnActive: {
    borderWidth: 1,
    borderColor: GlassTheme.primary,
    backgroundColor: "rgba(139,92,246,0.15)",
  },
  langBtnInactive: {
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  langBtnTextActive: {
    color: GlassTheme.primary,
  },
  langBtnTextInactive: {
    color: GlassTheme.textMuted,
  },

  /* ── Sign Out ── */
  signOutSection: {
    marginTop: 28,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,59,48,0.3)",
    backgroundColor: "rgba(255,59,48,0.08)",
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
