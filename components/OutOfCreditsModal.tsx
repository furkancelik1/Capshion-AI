import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlassTheme } from "../constants/LiquidGlass";

interface OutOfCreditsModalProps {
  visible: boolean;
  onClose: () => void;
  onBuy?: () => void;
}

export default function OutOfCreditsModal({
  visible,
  onClose,
  onBuy,
}: OutOfCreditsModalProps) {

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={GlassTheme.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="flash" size={36} color="#A78BFA" />
          </View>

          <Text style={styles.title}>Kredi Bakiyeniz Tükendi ⚡</Text>

          <Text style={styles.description}>
            Harika içerikler üretmeye devam etmek için kredini yenileyebilirsin.
            Sana özel paketleri görmek için aşağıdaki butona göz at.
          </Text>

          <TouchableOpacity
            style={styles.buyButton}
            onPress={onBuy || onClose}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#7A53FF", "#3B82F6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buyGradient}
            >
              <Ionicons
                name="card-outline"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.buyText}>Kredi Satın Al</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={styles.laterText}>Daha Sonra</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(10, 10, 10, 0.8)",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    backgroundColor: GlassTheme.cardBackground,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 16,
    ...GlassTheme.cardShadow,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(122, 83, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(122, 83, 255, 0.3)",
    shadowColor: "#7A53FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
  },
  description: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  buyButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
    ...GlassTheme.cardShadow,
  },
  buyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  buyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  laterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  laterText: {
    fontSize: 14,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
});
