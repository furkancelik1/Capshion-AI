import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { GlassTheme } from "@/constants/LiquidGlass";
import HapticButton from "@/components/HapticButton";
import GlassPanel from "@/components/GlassPanel";
import AmbientGlow from "@/components/AmbientGlow";
import AgeRangeSelector from "@/components/AgeRangeSelector";
import { PersonIcon, LogOutIcon, SparkleIcon } from "@/components/GlassIcons";
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
  credits: number;
  age_range: string | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingAge, setEditingAge] = useState(false);
  const [ageRange, setAgeRange] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      if (!user) return;
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("email, credits, age_range")
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
                {profile?.email ? profile.email[0].toUpperCase() : (
                  <PersonIcon size={32} />
                )}
              </Text>
            </View>
          </LinearGradient>
          <Text style={styles.emailText}>
            {profile?.email || user?.email}
          </Text>
        </View>

        <View style={styles.content}>
          <GlassPanel style={styles.card}>
            <View style={styles.cardHeader}>
              <SparkleIcon size={20} />
              <Text style={styles.cardTitle}>Yapay Zeka Kredisi</Text>
            </View>
            {loadingProfile ? (
              <ActivityIndicator
                size="small"
                color={GlassTheme.textMain}
                style={{ marginVertical: 8 }}
              />
            ) : (
              <Text style={styles.creditCount}>
                {profile?.credits !== undefined ? profile.credits : 0}{" "}
                <Text style={styles.creditLabel}>Kredi</Text>
              </Text>
            )}
            <Text style={styles.cardSubText}>
              Her caption üretimi 1 kredi tüketir.
            </Text>
          </GlassPanel>

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

          <HapticButton
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOutIcon size={20} />
            <Text style={styles.signOutText}>Çıkış Yap</Text>
          </HapticButton>
        </View>
      </ScrollView>
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
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },
  creditCount: {
    fontSize: 36,
    fontWeight: "700",
    color: GlassTheme.textMain,
    marginVertical: 4,
  },
  creditLabel: {
    fontSize: 18,
    fontWeight: "400",
    color: GlassTheme.textMuted,
  },
  cardSubText: {
    fontSize: 12,
    color: GlassTheme.textMuted,
  },
  ageDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  signOutText: {
    color: GlassTheme.dangerText,
    fontSize: 16,
    fontWeight: "600",
  },
});
