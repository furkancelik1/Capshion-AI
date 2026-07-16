import AgeRangeSelector from "@/components/AgeRangeSelector";
import AmbientGlow from "@/components/AmbientGlow";
import FeedbackModal from "@/components/FeedbackModal";
import { LogOutIcon, PersonIcon } from "@/components/GlassIcons";
import GlassPanel from "@/components/GlassPanel";
import HapticButton from "@/components/HapticButton";
import PaymentWebViewModal from "@/components/PaymentWebViewModal";
import { CREDIT_PACKAGES } from "@/constants/Packages";
import { GlassTheme } from "@/constants/LiquidGlass";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface UserProfile {
  email: string;
  credits_remaining: number; // credits -> credits_remaining olarak güncellendi
  age_range: string | null;
}

export default function ProfileScreen() {
  console.log("Paketler:", CREDIT_PACKAGES);
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingAge, setEditingAge] = useState(false);
  const [ageRange, setAgeRange] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Ödeme Akışı Stateleri
  const [isPaymentVisible, setIsPaymentVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [startingPayment, setStartingPayment] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      if (!user) return;
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("email, credits_remaining, age_range") // Sütun adı güncellendi
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setAgeRange(data.age_range);
      }
    } catch (error: any) {
      console.log("Profil yüklenirken hata:", error.message);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveAgeRange = async () => {
    if (!user || !ageRange) return;
    const { error } = await supabase
      .from("profiles")
      .update({ age_range: ageRange })
      .eq("id", user.id);
    if (error) {
      Alert.alert("Hata", "Yaş aralığı güncellenemedi.");
      return;
    }
    setEditingAge(false);
    setProfile((prev) => (prev ? { ...prev, age_range: ageRange } : prev));
  };

  const handleSignOut = () => {
    Alert.alert(
      "Çıkış Yap",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Evet", style: "destructive", onPress: signOut },
      ],
    );
  };

  // Kredi Satın Alma Fonksiyonu
  const handleBuyCredits = async (credits: number, price: number) => {
    try {
      setStartingPayment(true);

      console.log(`Ödeme isteği gönderiliyor... ${credits} kredi, ₺${price}`);

      const { data, error } = await supabase.functions.invoke(
        "iyzico-payment",
        {
          body: { price: price.toString(), credits },
        },
      );

      console.log("Supabase Yanıtı:", data);
      console.log("Supabase Hatası (varsa):", error);

      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }

      if (!data?.paymentUrl) {
        throw new Error("Ödeme linki alınamadı. Yanıt yapısı hatalı.");
      }

      setPaymentUrl(data.paymentUrl);
      setIsPaymentVisible(true);
    } catch (error: any) {
      console.error("Ödeme Başlatma Arayüz Hatası:", error);
      Alert.alert("Hata", "Ödeme başlatılamadı: " + error.message);
    } finally {
      setStartingPayment(false);
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
                <Text style={styles.balanceLabel}>Mevcut Bakiye</Text>
                <Text style={styles.creditCount}>
                  {profile?.credits_remaining !== undefined
                    ? profile.credits_remaining
                    : 0}
                </Text>
                <Text style={styles.creditLabel}>Kredi</Text>
                <Text style={styles.cardSubText}>
                  Kredi bakiyeniz içerik üretimiyle güncellenir
                </Text>
              </>
            )}
          </GlassPanel>

          {/* Kredi Paketleri — Bakiyeni Yükselt */}
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>Bakiyeni Yükselt</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.packagesRow}
            >
              <HapticButton
                style={styles.packageCard}
                onPress={() => handleBuyCredits(10, 50)}
                disabled={startingPayment}
              >
                <Text style={styles.packageCredits}>10</Text>
                <Text style={styles.packageLabel}>Kredi</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>₺50</Text>
              </HapticButton>
              <HapticButton
                style={[styles.packageCard, styles.packageCardPopular]}
                onPress={() => handleBuyCredits(30, 120)}
                disabled={startingPayment}
              >
                <Text style={styles.packageCredits}>30</Text>
                <Text style={styles.packageLabel}>Kredi</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>₺120</Text>
              </HapticButton>
              <HapticButton
                style={styles.packageCard}
                onPress={() => handleBuyCredits(50, 200)}
                disabled={startingPayment}
              >
                <Text style={styles.packageCredits}>50</Text>
                <Text style={styles.packageLabel}>Kredi</Text>
                <View style={styles.packageDivider} />
                <Text style={styles.packagePrice}>₺200</Text>
              </HapticButton>
            </ScrollView>
          </View>

          {/* Yaş Aralığı */}
          <GlassPanel style={styles.card}>
            <Text style={styles.cardTitle}>Yaş Aralığı</Text>
            {editingAge ? (
              <View style={styles.ageEditWrap}>
                <AgeRangeSelector value={ageRange} onChange={setAgeRange} />
                <View style={styles.ageActions}>
                  <HapticButton
                    style={styles.ageSaveBtn}
                    onPress={handleSaveAgeRange}
                  >
                    <Text style={styles.ageSaveText}>Kaydet</Text>
                  </HapticButton>
                  <HapticButton
                    style={styles.ageCancelBtn}
                    onPress={() => {
                      setEditingAge(false);
                      setAgeRange(profile?.age_range || null);
                    }}
                  >
                    <Text style={styles.ageCancelText}>İptal</Text>
                  </HapticButton>
                </View>
              </View>
            ) : (
              <View style={styles.ageDisplay}>
                <Text style={styles.ageValue}>
                  {profile?.age_range || "Belirtilmedi"}
                </Text>
                <HapticButton
                  style={styles.ageEditBtn}
                  onPress={() => setEditingAge(true)}
                >
                  <Text style={styles.ageEditText}>Düzenle</Text>
                </HapticButton>
              </View>
            )}
          </GlassPanel>

          {/* Deneyimini Geliştir */}
          <HapticButton
            style={styles.feedbackButton}
            onPress={() => setShowFeedback(true)}
          >
            <Text style={styles.feedbackText}>Deneyimini Geliştir</Text>
          </HapticButton>

          {/* Çıkış Yap */}
          <HapticButton style={styles.signOutButton} onPress={handleSignOut}>
            <LogOutIcon size={20} />
            <Text style={styles.signOutText}>Çıkış Yap</Text>
          </HapticButton>
        </View>
      </ScrollView>

      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        userId={user?.id}
      />

      {/* İyzico WebView Modalı */}
      <PaymentWebViewModal
        visible={isPaymentVisible}
        paymentUrl={paymentUrl}
        successUrl="https://rkacxgouberhvygsefqu.supabase.co/functions/v1/iyzico-payment-callback?status=success"
        failureUrl="https://rkacxgouberhvygsefqu.supabase.co/functions/v1/iyzico-payment-callback?status=failure"
        onSuccess={() => {
          setIsPaymentVisible(false);
          fetchProfile(); // Bakiyeyi anında güncellemek için profili yeniden çekiyoruz
          Alert.alert("Başarılı!", "Kredileriniz hesabınıza tanımlandı.");
        }}
        onFailure={(error) => {
          setIsPaymentVisible(false);
          Alert.alert(
            "Ödeme Başarısız",
            error || "İşlem sırasında bir hata oluştu.",
          );
        }}
        onClose={() => setIsPaymentVisible(false)}
      />
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
});
