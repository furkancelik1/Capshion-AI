import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import AmbientGlow from "../../components/AmbientGlow";
import { ClockIcon } from "../../components/GlassIcons";
import GlassEmptyState from "../../components/GlassEmptyState";
import GlassPanel from "../../components/GlassPanel";
import { HistoryCardSkeleton } from "../../components/GlassSkeleton";
import { useToast } from "../../context/ToastContext";
import { GlassTheme } from "../../constants/LiquidGlass";
import { api, getToken } from "../../services/api";
import { router } from "expo-router";

interface HistoryItem {
  id: string;
  caption_text: string;
  hashtags: string[];
  created_at: string;
  post_id: string;
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, []),
  );

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

  const handleDelete = useCallback(async (item: HistoryItem) => {
    Alert.alert(t("history.deleteTitle"), t("history.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteCaption(item.id);
            setData((prev) => prev.filter((c) => c.id !== item.id));
            showToast(t("history.deleted"), "success");
          } catch {
            showToast(t("common.error"), "error");
          }
        },
      },
    ]);
  }, [t, showToast]);

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

  const renderRightActions = useCallback(
    (item: HistoryItem) => {
      const close = () => swipeRefs.current[item.id]?.close();

      return (
        <View style={styles.swipeActions}>
          <TouchableOpacity
            style={styles.swipeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleCopy(item);
              close();
            }}
          >
            <Ionicons name="copy-outline" size={22} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeBtnDanger]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              close();
              handleDelete(item);
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      );
    },
    [handleCopy, handleDelete],
  );

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const showCopied = copiedId === item.id;

    return (
      <Swipeable
        ref={(ref) => { swipeRefs.current[item.id] = ref; }}
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
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
      </Swipeable>
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
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <HistoryCardSkeleton key={i} />
          ))}
        </ScrollView>
      )}

      {error && (
        <GlassPanel style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </GlassPanel>
      )}

      {!loading && !error && data.length === 0 && (
        <GlassEmptyState
          iconName="document-text-outline"
          title={t("history.emptyTitle")}
          description={t("history.emptyDescription")}
          buttonText={t("history.emptyAction")}
          onPress={() => router.push("/")}
        />
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
    backgroundColor: 'transparent',
    padding: 20,
    paddingTop: 100,
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
  listContent: {
    paddingBottom: 140,
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
  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  swipeBtn: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderWidth: 0.5,
    borderColor: "#8B5CF6",
    borderTopLeftRadius: GlassTheme.radiusMd,
    borderBottomLeftRadius: GlassTheme.radiusMd,
  },
  swipeBtnDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
    borderTopRightRadius: GlassTheme.radiusMd,
    borderBottomRightRadius: GlassTheme.radiusMd,
  },
});
