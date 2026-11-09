import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { GlassTheme } from "../constants/LiquidGlass";
import { useToast } from "../context/ToastContext";
import { DAILY_RITUAL_ENABLED, useDailyRitual } from "../hooks/useDailyRitual";
import type { DailyNiche } from "../services/api";

const HOURS = [8, 9, 10, 12, 15, 18, 20, 21];
const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Ana sayfadaki "Bugünün fikri" kartı: günün fikri + seri + günlük bildirim kurulumu. */
export default function DailyRitualCard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { data, savePreferences } = useDailyRitual();
  const [copied, setCopied] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  if (!DAILY_RITUAL_ENABLED || !data || !data.idea) return null;
  const { idea, streak, preferences } = data;
  const notifying = preferences.optedIn && preferences.enabled;

  const copyHook = async () => {
    try {
      await Clipboard.setStringAsync(idea.hook);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* önemsiz */
    }
  };

  return (
    <Reanimated.View entering={FadeIn.duration(250)} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>{t("daily.title")}</Text>
        <View style={[styles.streakChip, streak.current > 0 && styles.streakChipOn]}>
          <Text style={[styles.streakText, streak.current > 0 && styles.streakTextOn]}>
            {streak.current > 0 ? `🔥 ${t("daily.streakDays", { count: streak.current })}` : t("daily.streakStart")}
          </Text>
        </View>
      </View>

      <Text style={styles.ideaTitle}>{idea.title}</Text>
      <Text style={styles.ideaText}>{idea.idea}</Text>
      {idea.tip ? (
        <View style={styles.tipRow}>
          <Ionicons name="bulb-outline" size={14} color={GlassTheme.textMuted} />
          <Text style={styles.tipText}>{idea.tip}</Text>
        </View>
      ) : null}

      {idea.hook ? (
        <Pressable style={styles.hookBox} onPress={copyHook} accessibilityRole="button" accessibilityLabel={t("daily.copyHook")}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hookLabel}>{t("daily.hookLabel")}</Text>
            <Text style={styles.hookText}>{idea.hook}</Text>
          </View>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? GlassTheme.primary : GlassTheme.textMuted} />
        </Pressable>
      ) : null}

      <Text style={styles.streakHint}>
        {streak.activeToday
          ? t("daily.streakDone")
          : streak.current > 0
            ? t("daily.streakKeep", { next: streak.current + 1 })
            : t("daily.streakFirst")}
      </Text>

      <View style={styles.footer}>
        {notifying ? (
          <>
            <Text style={styles.footerMuted}>
              {t("daily.scheduleSummary", { hour: fmtHour(preferences.notifyHour), niche: t(`daily.niches.${preferences.niche}`) })}
            </Text>
            <Pressable onPress={() => setSetupOpen(true)} hitSlop={8}>
              <Text style={styles.footerLink}>{t("daily.edit")}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.enableBtn} onPress={() => setSetupOpen(true)}>
            <Ionicons name="notifications-outline" size={16} color="#fff" />
            <Text style={styles.enableText}>{t("daily.enableCta")}</Text>
          </Pressable>
        )}
      </View>

      <SetupModal
        visible={setupOpen}
        initialNiche={preferences.niche}
        initialHour={preferences.notifyHour}
        canDisable={notifying}
        onClose={() => setSetupOpen(false)}
        onSave={async (niche, hour, enabled) => {
          try {
            if (enabled) {
              const perm = await Notifications.getPermissionsAsync();
              const granted = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
              if (!granted) showToast?.(t("daily.permissionDenied"), "info");
            }
            await savePreferences({ niche, notifyHour: hour, enabled });
            setSetupOpen(false);
            showToast?.(enabled ? t("daily.saved") : t("daily.disabled"), "success");
          } catch {
            showToast?.(t("daily.error"), "error");
          }
        }}
      />
    </Reanimated.View>
  );
}

function SetupModal({
  visible, initialNiche, initialHour, canDisable, onClose, onSave,
}: {
  visible: boolean;
  initialNiche: DailyNiche;
  initialHour: number;
  canDisable: boolean;
  onClose: () => void;
  onSave: (niche: DailyNiche, hour: number, enabled: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [niche, setNiche] = useState<DailyNiche>(initialNiche);
  const [hour, setHour] = useState(initialHour);
  const [saving, setSaving] = useState(false);
  const niches = Object.keys(t("daily.niches", { returnObjects: true }) as Record<string, string>) as DailyNiche[];

  useEffect(() => {
    if (visible) { setNiche(initialNiche); setHour(initialHour); }
  }, [visible, initialNiche, initialHour]);

  const save = async (enabled: boolean) => {
    setSaving(true);
    try { await onSave(niche, hour, enabled); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("daily.setupTitle")}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={GlassTheme.textMain} />
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>{t("daily.setupSub")}</Text>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            <Text style={styles.sectionLabel}>{t("daily.nicheLabel")}</Text>
            <View style={styles.chips}>
              {niches.map((n) => (
                <Pressable key={n} style={[styles.chip, niche === n && styles.chipOn]} onPress={() => { Haptics.selectionAsync(); setNiche(n); }}>
                  <Text style={[styles.chipText, niche === n && styles.chipTextOn]}>{t(`daily.niches.${n}`)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>{t("daily.hourLabel")}</Text>
            <View style={styles.chips}>
              {HOURS.map((h) => (
                <Pressable key={h} style={[styles.chip, hour === h && styles.chipOn]} onPress={() => { Haptics.selectionAsync(); setHour(h); }}>
                  <Text style={[styles.chipText, hour === h && styles.chipTextOn]}>{fmtHour(h)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => save(true)} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t("daily.save")}</Text>}
          </Pressable>
          {canDisable ? (
            <Pressable onPress={() => save(false)} disabled={saving} style={styles.disableBtn}>
              <Text style={styles.disableText}>{t("daily.disable")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GlassTheme.panel, borderRadius: GlassTheme.radiusLg, padding: 18, gap: 10,
    borderWidth: 1, borderColor: GlassTheme.border, ...GlassTheme.cardShadow,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { fontSize: 12, fontWeight: "700", color: GlassTheme.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  streakChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: GlassTheme.radiusPill, backgroundColor: "rgba(0,0,0,0.05)" },
  streakChipOn: { backgroundColor: "rgba(255,149,0,0.12)" },
  streakText: { fontSize: 12, fontWeight: "700", color: GlassTheme.textMuted },
  streakTextOn: { color: "#C26A00" },
  ideaTitle: { fontSize: 19, fontWeight: "800", color: GlassTheme.textMain, letterSpacing: -0.3 },
  ideaText: { fontSize: 15, color: GlassTheme.textMain, lineHeight: 22, opacity: 0.85 },
  tipRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 13, color: GlassTheme.textMuted, lineHeight: 18 },
  hookBox: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: GlassTheme.radiusSm,
    backgroundColor: "rgba(52,199,89,0.07)", borderWidth: 1, borderColor: GlassTheme.selectedBorder,
  },
  hookLabel: { fontSize: 11, fontWeight: "700", color: GlassTheme.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  hookText: { fontSize: 14, color: GlassTheme.textMain, lineHeight: 20 },
  streakHint: { fontSize: 13, color: GlassTheme.textMuted },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  footerMuted: { flex: 1, fontSize: 13, color: GlassTheme.textMuted },
  footerLink: { fontSize: 13, fontWeight: "700", color: GlassTheme.primary },
  enableBtn: {
    flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: GlassTheme.textMain, borderRadius: GlassTheme.radiusPill, paddingVertical: 11,
  },
  enableText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: GlassTheme.overlayBg },
  sheet: { backgroundColor: GlassTheme.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, gap: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: GlassTheme.textMain },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  sheetSub: { fontSize: 14, color: GlassTheme.textMuted, lineHeight: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: GlassTheme.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: GlassTheme.radiusPill, borderWidth: 1, borderColor: GlassTheme.border, backgroundColor: GlassTheme.bg },
  chipOn: { backgroundColor: GlassTheme.textMain, borderColor: GlassTheme.textMain },
  chipText: { fontSize: 14, fontWeight: "600", color: GlassTheme.textMain },
  chipTextOn: { color: "#fff" },
  saveBtn: { backgroundColor: GlassTheme.primaryButtonBg, borderRadius: GlassTheme.radiusPill, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disableBtn: { alignItems: "center", paddingVertical: 8 },
  disableText: { color: GlassTheme.dangerText, fontWeight: "600" },
});
