import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlassTheme } from "../constants/LiquidGlass";

interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HowItWorksModal({
  visible,
  onClose,
}: HowItWorksModalProps) {
  const { t } = useTranslation();

  const STEPS = [
    {
      emoji: "📸",
      title: t("howItWorks.step1Title"),
      desc: t("howItWorks.step1Desc"),
    },
    {
      emoji: "🤖",
      title: t("howItWorks.step2Title"),
      desc: t("howItWorks.step2Desc"),
    },
    {
      emoji: "📋",
      title: t("howItWorks.step3Title"),
      desc: t("howItWorks.step3Desc"),
    },
  ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <BlurView
          intensity={GlassTheme.blurIntensity + 10}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.container}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{t("howItWorks.title")}</Text>

            <View style={styles.stepsWrap}>
              {STEPS.map((item, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepEmoji}>{item.emoji}</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{item.title}</Text>
                    <Text style={styles.stepDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "85%",
    maxWidth: 360,
    backgroundColor: GlassTheme.cardBackground,
    borderRadius: GlassTheme.radiusLg,
    borderWidth: 1,
    borderColor: GlassTheme.glassBorder,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 20,
    ...GlassTheme.cardShadow,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GlassTheme.panelStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GlassTheme.glassBorder,
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 14,
    color: GlassTheme.textMain,
    fontWeight: "700",
    lineHeight: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: GlassTheme.textMain,
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  stepsWrap: {
    gap: 18,
    paddingTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  stepEmoji: {
    fontSize: 22,
    marginTop: 1,
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: GlassTheme.textMain,
    letterSpacing: 0.5,
  },
  stepDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: GlassTheme.textSub,
    lineHeight: 19,
    opacity: 0.9,
  },
});
