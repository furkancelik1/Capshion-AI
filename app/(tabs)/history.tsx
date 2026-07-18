import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AmbientGlow from "../../components/AmbientGlow";
import { ClockIcon } from "../../components/GlassIcons";
import GlassPanel from "../../components/GlassPanel";
import { GlassTheme } from "../../constants/LiquidGlass";
import { api, getToken } from "../../services/api";

interface HistoryItem {
  id: string;
  caption_text: string;
  hashtags: string[];
  created_at: string;
  post_id: string;
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    if (!getToken()) {
      setError(t("history.errorSession"));
      setLoading(false);
      return;
    }

    try {
      const captions = await api.getCaptions();
      setData(captions || []);
    } catch (err: any) {
      setError(err.message || t("history.errorSession"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = useCallback(async (item: HistoryItem) => {
    await Clipboard.setStringAsync(item.caption_text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const showCopied = copiedId === item.id;

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => handleCopy(item)}>
        <GlassPanel style={styles.card}>
          <Text style={styles.captionText}>{item.caption_text}</Text>

          <View style={styles.chipsRow}>
            {(item.hashtags || []).map((tag, i) => (
              <View key={`${item.id}-tag-${i}`} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
            {showCopied && <Text style={styles.copiedText}>{t("history.copied")}</Text>}
          </View>
        </GlassPanel>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AmbientGlow />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ClockIcon size={22} />
          <Text style={styles.title}>{t("history.title")}</Text>
        </View>
        <Text style={styles.subtitle}>
          {t("history.subtitle")}
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={GlassTheme.primary} />
        </View>
      )}

      {error && (
        <GlassPanel style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </GlassPanel>
      )}

      {!loading && !error && data.length === 0 && (
        <GlassPanel style={styles.emptyCard}>
          <ClockIcon size={40} />
          <Text style={styles.emptyText}>{t("history.empty")}</Text>
        </GlassPanel>
      )}

      {!loading && data.length > 0 && (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorCard: {
    borderRadius: GlassTheme.radiusLg,
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.dangerText,
    textAlign: "center",
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
  listContent: {
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    borderRadius: GlassTheme.radiusMd,
    padding: 16,
    gap: 12,
  },
  captionText: {
    fontSize: 14,
    fontWeight: "500",
    color: GlassTheme.textMain,
    lineHeight: 21,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: GlassTheme.panelStrong,
    borderRadius: GlassTheme.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: GlassTheme.border,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: GlassTheme.textMuted,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontSize: 11,
    fontWeight: "500",
    color: GlassTheme.textMuted,
  },
  copiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: GlassTheme.primary,
  },
});
