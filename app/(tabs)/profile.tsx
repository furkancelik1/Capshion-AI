import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { GlassTheme } from "@/constants/LiquidGlass";
import HapticButton from "@/components/HapticButton";
import GlassPanel from "@/components/GlassPanel";
import AmbientGlow from "@/components/AmbientGlow";
import { PersonIcon, LogOutIcon, SparkleIcon } from "@/components/GlassIcons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface UserProfile {
  email: string;
  credits: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const fetchProfile = async () => {
    try {
      if (!user) return;

      setLoadingProfile(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("email, credits")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error: any) {
      console.log("Profil yüklenirken hata oluştu:", error.message);
      Alert.alert("Hata", "Profil bilgileri yüklenemedi.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

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
      <View style={styles.header}>
        <LinearGradient
          colors={[...GlassTheme.primaryGradient]}
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

        <HapticButton
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <LogOutIcon size={20} />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </HapticButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.bg,
    paddingHorizontal: 24,
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
    flex: 1,
    gap: 20,
  },
  card: {
    padding: 20,
    borderRadius: GlassTheme.radiusLg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
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
    marginTop: 8,
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
    marginTop: "auto",
    marginBottom: 32,
  },
  signOutText: {
    color: GlassTheme.dangerText,
    fontSize: 16,
    fontWeight: "600",
  },
});
