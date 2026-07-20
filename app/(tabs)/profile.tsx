import AgeRangeSelector from "@/components/AgeRangeSelector";
import AmbientGlow from "@/components/AmbientGlow";
import FeedbackModal from "@/components/FeedbackModal";
import { LogOutIcon, PersonIcon } from "@/components/GlassIcons";
import GlassPanel from "@/components/GlassPanel";
import HapticButton from "@/components/HapticButton";
import PaymentWebViewModal from "@/components/PaymentWebViewModal";
import { GlassTheme } from "@/constants/LiquidGlass";
import { useAuth } from "@/hooks/useAuth";
import { usePayment } from "@/hooks/usePayment";
import { api } from "@/services/api";
import { LinearGradient } from "expo-linear-gradient";
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

interface UserProfile {
  email: string;
  credits_remaining: number;
  age_range: string | null;
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
        <View style={styles.header}>
          <LinearGradient
            colors={[...GlassTheme.gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>
                {profile?.email ? (
                  profile.email[0].toUpperCase()
                ) : (
                  <PersonIcon size={32} />
                )}
              </Text>
            </View>
          </LinearGradient>
          <Text style={styles.emailText}>{profile?.email || user?.email}</Text>
        </View>

        <View style={styles.content}>
          {/* Kredi Bakiyesi Kartı */}
          <GlassPanel style={styles.card}>
            {loadingProfile ? (
              <ActivityIndicator
                size="small"
                color={GlassTheme.textMain}
                style={{ marginVertical: 8 }}
              />
            ) : (
              <>
                <Text style={styles.balanceLabel}>{t("profile.balance")}</Text>
                <Text style={styles.creditCount}>
                  {profile?.credits_remaining !== undefined
                    ? profile.credits_remaining
                    : 0}
                </Text>
                <Text style={styles.creditLabel}>{t("profile.credits")}</Text>
                <Text style={styles.cardSubText}>
                  {t("profile.balanceNote")}
                </Text>
              </>
            )}
          </GlassPanel>

          {/* Kredi Paketleri — Bakiyeni Yükselt */}
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>{t("profile.topUp")}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.packagesRow}
            >
              <HapticButton
                style={styles.packageCard}
                  onPress={() => initiatePayment(10, i18n.language?.startsWith("tr") ? "50.0" : "2.99")}
              >
                <Text style={styles.packageCredits}>10</Text>
                <Text style={styles.packageLabel}>{t("profile.credits")}</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>
                  {i18n.language?.startsWith("tr") ? "₺50" : "$2.99"}
                </Text>
              </HapticButton>
              <HapticButton
                style={[styles.packageCard, styles.packageCardPopular]}
                  onPress={() => initiatePayment(30, i18n.language?.startsWith("tr") ? "120.0" : "6.99")}
              >
                <Text style={styles.packageCredits}>30</Text>
                <Text style={styles.packageLabel}>{t("profile.credits")}</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>
                  {i18n.language?.startsWith("tr") ? "₺120" : "$6.99"}
                </Text>
              </HapticButton>
              <HapticButton
                style={styles.packageCard}
                  onPress={() => initiatePayment(50, i18n.language?.startsWith("tr") ? "200.0" : "11.99")}
              >
                <Text style={styles.packageCredits}>50</Text>
                <Text style={styles.packageLabel}>{t("profile.credits")}</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>
                  {i18n.language?.startsWith("tr") ? "₺200" : "$11.99"}
                </Text>
              </HapticButton>
            </ScrollView>
          </View>

          {/* Yaş Aralığı */}
          <GlassPanel style={styles.card}>
            <Text style={styles.cardTitle}>{t("profile.ageRange")}</Text>
            {editingAge ? (
              <View style={styles.ageEditWrap}>
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
              </View>
            ) : (
              <View style={styles.ageDisplay}>
                <Text style={styles.ageValue}>
                  {profile?.age_range || t("profile.ageNotSet")}
                </Text>
                <HapticButton
                  style={styles.ageEditBtn}
                  onPress={() => setEditingAge(true)}
                >
                  <Text style={styles.ageEditText}>{t("common.edit")}</Text>
                </HapticButton>
              </View>
            )}
          </GlassPanel>

          {/* Dil Seçimi */}
          <View style={styles.langSection}>
            <Text style={styles.langLabel}>{t("profile.language")}</Text>
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
          </View>

          {/* Deneyimini Geliştir */}
          <HapticButton
            style={styles.feedbackButton}
            onPress={() => setShowFeedback(true)}
          >
            <Text style={styles.feedbackText}>{t("profile.feedback")}</Text>
          </HapticButton>

          {/* Çıkış Yap */}
          <HapticButton style={styles.signOutButton} onPress={handleSignOut}>
            <LogOutIcon size={20} />
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
    backgroundColor: GlassTheme.bg,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 32,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: GlassTheme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: GlassTheme.textMain,
    fontSize: 32,
    fontWeight: "700",
  },
  emailText: {
    fontSize: 18,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },
  content: {
    gap: 20,
  },
  card: {
    padding: 20,
    borderRadius: GlassTheme.radiusLg,
    gap: 12,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    letterSpacing: 0.5,
  },
  creditCount: {
    fontSize: 52,
    fontWeight: "800",
    color: GlassTheme.textMain,
    lineHeight: 60,
  },
  creditLabel: {
    fontSize: 18,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    marginTop: -4,
  },
  cardSubText: {
    fontSize: 12,
    color: GlassTheme.textMuted,
    marginTop: 4,
  },
  packagesSection: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: GlassTheme.textMain,
    paddingHorizontal: 2,
  },
  packagesRow: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 24,
  },
  packageCard: {
    width: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    backgroundColor: GlassTheme.panel,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 4,
  },
  packageCardPopular: {
    borderColor: GlassTheme.primary,
    borderWidth: 1.5,
  },
  packageCredits: {
    fontSize: 28,
    fontWeight: "800",
    color: GlassTheme.textMain,
  },
  packageLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
  },
  packageDivider: {
    width: 32,
    height: 1,
    backgroundColor: GlassTheme.border,
    marginVertical: 6,
  },
  packagePrice: {
    fontSize: 15,
    fontWeight: "700",
    color: GlassTheme.primary,
  },
  ageDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  ageValue: {
    fontSize: 16,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },
  ageEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: GlassTheme.radiusSm,
    borderWidth: 1,
    borderColor: GlassTheme.border,
  },
  ageEditText: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
  ageEditWrap: {
    gap: 12,
    width: "100%",
  },
  ageActions: {
    flexDirection: "row",
    gap: 10,
  },
  ageSaveBtn: {
    flex: 1,
    height: 44,
    backgroundColor: GlassTheme.primary,
    borderRadius: GlassTheme.radiusSm,
    alignItems: "center",
    justifyContent: "center",
  },
  ageSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ageCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: GlassTheme.radiusSm,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ageCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
  feedbackButton: {
    height: 48,
    borderRadius: GlassTheme.radiusSm,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: GlassTheme.radiusMd,
    borderWidth: 1.5,
    borderColor: GlassTheme.dangerBorder,
    backgroundColor: GlassTheme.dangerBg,
    marginTop: 8,
    marginBottom: 12,
  },
  signOutText: {
    color: GlassTheme.dangerText,
    fontSize: 16,
    fontWeight: "600",
  },
  langSection: {
    gap: 10,
  },
  langLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    letterSpacing: 0.5,
  },
  langRow: {
    flexDirection: "row",
    gap: 10,
  },
  langBtn: {
    flex: 1,
    height: 48,
    borderRadius: GlassTheme.radiusSm,
    alignItems: "center",
    justifyContent: "center",
  },
  langBtnActive: {
    borderWidth: 1.5,
    borderColor: GlassTheme.primary,
    backgroundColor: GlassTheme.panel,
  },
  langBtnInactive: {
    borderWidth: 1,
    borderColor: GlassTheme.border,
    backgroundColor: GlassTheme.panel,
  },
  langBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  langBtnTextActive: {
    color: GlassTheme.primary,
  },
  langBtnTextInactive: {
    color: GlassTheme.textMuted,
  },
});
