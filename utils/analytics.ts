import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type AnalyticsParams = Record<string, string | number | boolean>;
type AnalyticsModule = typeof import('@react-native-firebase/analytics');

// undefined: henüz denenmedi, null: bu ortamda kullanılamıyor
let cachedModule: AnalyticsModule | null | undefined;

/**
 * Native Firebase modülünü ilk kullanımda yükler. Expo Go ve web'de native
 * modül bulunmadığı için hiç denenmez; eksik build'lerde require/getAnalytics
 * hatası yakalanır ve sonuç null olarak önbelleğe alınır.
 */
function loadAnalytics(): AnalyticsModule | null {
  if (cachedModule !== undefined) return cachedModule;

  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cachedModule = null;
    return cachedModule;
  }

  try {
    const mod: AnalyticsModule = require('@react-native-firebase/analytics');
    mod.getAnalytics(); // native modül yoksa burada fırlatır
    cachedModule = mod;
  } catch (err) {
    console.log('[Analytics] Firebase native modülü yok, analytics devre dışı:', err);
    cachedModule = null;
  }
  return cachedModule;
}

/**
 * Firebase Analytics'e olay gönderir. Cihazda Firebase yapılandırılmamışsa
 * veya istek başarısız olursa sessizce loglar, uygulamayı asla düşürmez.
 */
export async function logAppEvent(eventName: string, params?: AnalyticsParams): Promise<void> {
  const mod = loadAnalytics();
  if (!mod) return;

  try {
    await mod.logEvent(mod.getAnalytics(), eventName, params);
  } catch (err) {
    console.log('[Analytics] Event gönderilemedi:', eventName, err);
  }
}
