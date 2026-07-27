import { useMemo, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { GlassTheme } from "@/constants/LiquidGlass";
import HapticButton from "./HapticButton";

const TONE_IDS = ["cool", "humorous", "minimal", "professional", "storyteller", "viral", "luxury"];

const VIP_TONE_IDS = new Set(["viral", "luxury", "storyteller"]);

interface GlassBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
  selectedTone: string | null;
  onToneSelect: (toneId: string) => void;
  isPremium?: boolean;
  onPremiumRequired?: () => void;
}

export default function GlassBottomSheet({
  bottomSheetRef,
  selectedTone,
  onToneSelect,
  isPremium,
  onPremiumRequired,
}: GlassBottomSheetProps) {
  const { t } = useTranslation();
  const snapPoints = useMemo(() => ["55%"], []);

  const handleSelect = useCallback(
    (toneId: string) => {
      const isVip = VIP_TONE_IDS.has(toneId);
      if (isVip && !isPremium) {
        onPremiumRequired?.();
        return;
      }
      onToneSelect(toneId);
      bottomSheetRef.current?.dismiss();
    },
    [onToneSelect, bottomSheetRef, isPremium, onPremiumRequired],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.indicator}
      handleStyle={styles.handle}
      animationConfigs={{
        damping: 20,
        stiffness: 300,
        mass: 1,
      }}
    >
      <BottomSheetView style={styles.content}>
        <BlurView
          intensity={70}
          tint="systemThinMaterialDark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.inner}>
          <Text style={styles.title}>{t("home.selectTone")}</Text>

          <View style={styles.list}>
            {TONE_IDS.map((id) => {
              const isSelected = selectedTone === id;
              const isVip = VIP_TONE_IDS.has(id);
              const locked = isVip && !isPremium;
              return (
                <HapticButton
                  key={id}
                  style={[
                    styles.row,
                    isSelected && styles.rowSelected,
                    locked && styles.rowLocked,
                  ]}
                  onPress={() => handleSelect(id)}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.rowLabelRow}>
                      <Text style={[styles.rowName, locked && styles.rowNameLocked]}>
                        {locked ? "🔒  " : ""}{t(`tones.${id}.name`)}
                      </Text>
                      {locked && (
                        <View style={styles.proBadge}>
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.rowPrompt, locked && styles.rowPromptLocked]}>
                      {t(`tones.${id}.prompt`)}
                    </Text>
                  </View>
                  {isSelected && !locked && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={GlassTheme.primary}
                    />
                  )}
                </HapticButton>
              );
            })}
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: "transparent",
  },
  handle: {
    paddingTop: 10,
  },
  indicator: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: GlassTheme.neonPlatinum,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 16,
    textAlign: "center",
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rowSelected: {
    borderColor: GlassTheme.primary,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  rowLocked: {
    opacity: 0.6,
    borderColor: "rgba(251,191,36,0.25)",
  },
  rowLeft: {
    gap: 4,
    flex: 1,
  },
  rowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: GlassTheme.textMain,
    letterSpacing: 0.5,
  },
  rowNameLocked: {
    color: "rgba(255,255,255,0.4)",
  },
  rowPrompt: {
    fontSize: 12,
    fontWeight: "500",
    color: GlassTheme.textMuted,
  },
  rowPromptLocked: {
    color: "rgba(255,255,255,0.25)",
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(251,191,36,0.15)",
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
});
