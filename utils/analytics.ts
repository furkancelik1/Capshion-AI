import analytics from '@react-native-firebase/analytics';

type AnalyticsParams = Record<string, string | number | boolean>;

/**
 * Firebase Analytics'e olay gönderir. Cihazda Firebase yapılandırılmamışsa
 * veya istek başarısız olursa sessizce loglar, uygulamayı asla düşürmez.
 */
export async function logAppEvent(eventName: string, params?: AnalyticsParams): Promise<void> {
  try {
    await analytics().logEvent(eventName, params);
  } catch (err) {
    console.log('[Analytics] Event gönderilemedi:', eventName, err);
  }
}
