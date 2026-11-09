import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import i18next from "i18next";
import { usePostHog } from "posthog-react-native";
import { useCallback, useRef, useState } from "react";
import { api, DailyNiche, DailyToday } from "../services/api";
import { DAILY_PUSH_FLAG_KEY, schedulePeriodicReminder } from "./usePushNotifications";

// Geliştirmede açık; build'lerde EXPO_PUBLIC_DAILY_RITUAL=true ile.
export const DAILY_RITUAL_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DAILY_RITUAL === "true";

const lang = () => (i18next.language?.startsWith("en") ? "en" : "tr");

async function syncLocalReminderFlag(on: boolean) {
  try {
    await AsyncStorage.setItem(DAILY_PUSH_FLAG_KEY, on ? "1" : "0");
    await schedulePeriodicReminder(); // bayrağa göre 3 günlük yerel hatırlatmayı kapatır/açar
  } catch {
    // önemsiz
  }
}

export function useDailyRitual() {
  const posthog = usePostHog();
  const [data, setData] = useState<DailyToday | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedDate = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!DAILY_RITUAL_ENABLED) return;
    setLoading(true);
    try {
      const today = await api.dailyToday(lang());
      setData(today);
      if (loadedDate.current !== today.date) {
        loadedDate.current = today.date;
        posthog?.capture("daily_idea_viewed", { niche: today.niche, streak: today.streak.current });
      }
      syncLocalReminderFlag(today.preferences.optedIn && today.preferences.enabled);
    } catch {
      // kart sessizce gizlenir; ana akış etkilenmez
    } finally {
      setLoading(false);
    }
  }, [posthog]);

  // Sekmeye her dönüşte tazele: üretim yapınca seri hemen güncellenir
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const savePreferences = useCallback(async (prefs: { niche: DailyNiche; notifyHour: number; enabled: boolean }) => {
    const res = await api.dailyPreferences({ ...prefs, language: lang() });
    posthog?.capture("daily_preferences_saved", { niche: prefs.niche, hour: prefs.notifyHour, enabled: prefs.enabled });
    await syncLocalReminderFlag(prefs.enabled);
    await refresh(); // niş değiştiyse yeni nişin fikri gelsin
    return res.preferences;
  }, [posthog, refresh]);

  return { data, loading, refresh, savePreferences };
}
