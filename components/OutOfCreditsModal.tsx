import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <BlurView
            intensity={90}
            tint="systemThinMaterialDark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardInner}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="flash" size={36} color="#5AC8FA" />
          </View>

          <Text style={styles.title}>{t("outOfCredits.title")}</Text>

          <Text style={styles.description}>
            {t("outOfCredits.description")}
          </Text>

          <TouchableOpacity
            style={styles.buyButton}
            onPress={onBuy || onClose}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#0A84FF", "#64D2FF"]}
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
              <Text style={styles.buyText}>{t("outOfCredits.buyButton")}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={styles.laterText}>{t("outOfCredits.later")}</Text>
          </TouchableOpacity>
          </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.2)",
    overflow: "hidden",
    backgroundColor: "rgba(15, 15, 20, 0.75)",
  },
  cardInner: {
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 132, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.3)",
    shadowColor: "#0A84FF",
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
    borderRadius: 100,
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
