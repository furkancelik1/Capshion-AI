import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GlassTheme } from "../constants/LiquidGlass";

interface GeneratingModalProps {
  visible: boolean;
}

export default function GeneratingModal({ visible }: GeneratingModalProps) {
  const { t } = useTranslation();
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!visible) {
      setDots("");
      return;
    }
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator
            size="large"
            color={GlassTheme.primary}
          />
          <Text style={styles.title}>
            {t("generating.title")}{dots}
          </Text>
          <Text style={styles.subtitle}>
            {t("generating.subtitle")}
          </Text>
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
    paddingHorizontal: 20,
    backgroundColor: GlassTheme.background,
  },
  card: {
    width: "80%",
    maxWidth: 320,
    backgroundColor: GlassTheme.cardBackground,
    borderRadius: GlassTheme.radiusLg,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 16,
    ...GlassTheme.cardShadow,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: GlassTheme.textMain,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textMain,
    textAlign: "center",
    lineHeight: 19,
    opacity: 0.85,
  },
});
