import { usePostHog } from "posthog-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { isRewardedAdSupported, RewardedResult, showRewardedAd } from "../utils/rewardedAd";
import { useAuth } from "./useAuth";

// Uygulama tarafı anahtar: dev'de açık, build'lerde EXPO_PUBLIC_REWARDED_ADS=true ile.
// Asıl kapı sunucudaki ADS_REWARDED_ENABLED (status.enabled).
const CLIENT_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_REWARDED_ADS === "true";

const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 8; // SSV bildirimi genelde birkaç saniye içinde gelir

export type WatchOutcome =
  | { kind: "granted"; credits: number }
  | { kind: "pending" } // reklam bitti ama kredi henüz sunucuya yansımadı
  | { kind: Exclude<RewardedResult, "earned"> }
  | { kind: "limit" };

type AdsStatus = { enabled: boolean; remainingToday: number; dailyLimit: number; rewardCredits: number; devReward?: boolean };

export function useRewardedCredits() {
  const { user } = useAuth();
  const posthog = usePostHog();
  const [status, setStatus] = useState<AdsStatus | null>(null);
  const [watching, setWatching] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!CLIENT_ENABLED || !user?.id || user.is_premium || !isRewardedAdSupported()) {
      setStatus(null);
      return;
    }
    try {
      const s = await api.adsStatus();
      if (mounted.current) setStatus(s);
    } catch {
      if (mounted.current) setStatus(null);
    }
  }, [user?.id, user?.is_premium]);

  useEffect(() => { refresh(); }, [refresh]);

  const available = !!status?.enabled;
  const remainingToday = status?.remainingToday ?? 0;

  const watch = useCallback(async (source: string): Promise<WatchOutcome> => {
    if (!user?.id || watching) return { kind: "unavailable" };
    if (remainingToday <= 0) return { kind: "limit" };
    setWatching(true);
    posthog?.capture("rewarded_ad_requested", { source });
    try {
      const before = (await api.getProfile().catch(() => null))?.credits_remaining ?? null;
      const result = await showRewardedAd({ userId: user.id, customData: source });
      posthog?.capture("rewarded_ad_result", { source, result });
      if (result !== "earned") return { kind: result };

      // Geliştirmede test reklamları SSV göndermez; sunucu izin veriyorsa dev ödülü iste
      if (__DEV__ && status?.devReward) await api.adsDevReward().catch(() => {});

      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const profile = await api.getProfile().catch(() => null);
        const now = profile?.credits_remaining;
        if (typeof now === "number" && (before === null || now > before)) {
          posthog?.capture("rewarded_ad_credited", { source });
          return { kind: "granted", credits: now };
        }
      }
      return { kind: "pending" };
    } finally {
      if (mounted.current) setWatching(false);
      refresh();
    }
  }, [user?.id, watching, remainingToday, status?.devReward, posthog, refresh]);

  return { available, remainingToday, rewardCredits: status?.rewardCredits ?? 1, watching, watch, refresh };
}

/** Sonucu kullanıcıya gösterilecek toast mesajına çevirir. */
export function describeWatchOutcome(
  t: (key: string, opts?: Record<string, unknown>) => string,
  outcome: WatchOutcome,
  rewardCredits = 1,
): { message: string; type: "success" | "info" | "error" } {
  switch (outcome.kind) {
    case "granted": return { message: t("ads.granted", { count: rewardCredits }), type: "success" };
    case "pending": return { message: t("ads.pending"), type: "info" };
    case "dismissed": return { message: t("ads.notCompleted"), type: "info" };
    case "limit": return { message: t("ads.limitReached"), type: "info" };
    case "no-consent": return { message: t("ads.noConsent"), type: "info" };
    case "no-fill": return { message: t("ads.unavailable"), type: "info" };
    default: return { message: t("ads.error"), type: "error" };
  }
}
