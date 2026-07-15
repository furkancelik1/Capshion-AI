import { StyleSheet, Text, View } from "react-native";
import { GlassTheme } from "../../constants/LiquidGlass";
import GlassPanel from "../../components/GlassPanel";
import AmbientGlow from "../../components/AmbientGlow";
import { ClockIcon } from "../../components/GlassIcons";

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <AmbientGlow />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ClockIcon size={22} />
          <Text style={styles.title}>Geçmiş</Text>
        </View>
        <Text style={styles.subtitle}>
          Daha önce ürettiğin açıklamalar burada listelenecek.
        </Text>
      </View>
      <GlassPanel style={styles.emptyCard}>
        <ClockIcon size={40} />
        <Text style={styles.emptyText}>Henüz bir geçmiş kaydın yok.</Text>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.bg,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: GlassTheme.textMain,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: GlassTheme.textMuted,
  },
  emptyCard: {
    borderRadius: GlassTheme.radiusLg,
    padding: 32,
    alignItems: "center",
    gap: 14,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    textAlign: "center",
  },
});
