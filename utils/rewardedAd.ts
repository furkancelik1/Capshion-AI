import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type * as GMA from "react-native-google-mobile-ads";

/**
 * Ödüllü reklam (AdMob Rewarded) sarmalayıcısı.
 *
 * - Native modül yoksa (Expo Go, web, eski build) hiçbir şey çökmez: "unavailable" döner.
 * - İlk gösterimden önce UMP onayı toplanır (AB kullanıcıları), sonra SDK başlatılır.
 * - Kredi istemcide VERİLMEZ: userId, AdMob'un sunucuya gönderdiği imzalı SSV
 *   bildirimine eklenir ve krediyi sunucu verir (routes/ads.js).
 */

type GmaModule = typeof GMA;
export type RewardedResult = "earned" | "dismissed" | "no-fill" | "no-consent" | "unavailable" | "error";

const LOAD_TIMEOUT_MS = 15000;

// undefined: henüz denenmedi, null: bu ortamda kullanılamıyor
let cachedModule: GmaModule | null | undefined;

function loadGma(): GmaModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS === "web" || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cachedModule = null;
    return cachedModule;
  }
  try {
    cachedModule = require("react-native-google-mobile-ads") as GmaModule;
  } catch (err) {
    console.log("[Ads] Reklam native modülü yok, ödüllü reklam devre dışı:", err);
    cachedModule = null;
  }
  return cachedModule;
}

/** Geliştirmede Google'ın test birimi; build'lerde EAS ortam değişkeni. */
function rewardedAdUnitId(gma: GmaModule): string | null {
  if (__DEV__) return gma.TestIds.REWARDED;
  const id = Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID;
  return id || null;
}

/** Bu build'de ödüllü reklam gösterilebilir mi (native modül + reklam birimi var mı)? */
export function isRewardedAdSupported(): boolean {
  const gma = loadGma();
  return !!gma && !!rewardedAdUnitId(gma);
}

let readyPromise: Promise<boolean> | null = null;

/** Onayı topla → SDK'yı başlat. Oturum başına bir kez; onay yoksa sonraki denemede tekrar sorar. */
function prepare(gma: GmaModule): Promise<boolean> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    try {
      let canRequest = false;
      try {
        canRequest = (await gma.AdsConsent.gatherConsent()).canRequestAds;
      } catch (err) {
        // Form yüklenemezse (ağ vb.) önceki oturumdaki onay bilgisine bak
        console.log("[Ads] Onay formu hatası:", err);
        canRequest = (await gma.AdsConsent.getConsentInfo()).canRequestAds;
      }
      if (!canRequest) {
        readyPromise = null;
        return false;
      }
      // iOS: App Tracking Transparency izni (reddedilirse reklamlar IDFA olmadan gösterilir)
      if (Platform.OS === "ios") {
        try {
          const att = require("expo-tracking-transparency");
          const current = await att.getTrackingPermissionsAsync();
          if (current.status === "undetermined") await att.requestTrackingPermissionsAsync();
        } catch (err) {
          console.log("[Ads] ATT izni istenemedi:", err);
        }
      }
      await gma.default().initialize();
      return true;
    } catch (err) {
      console.log("[Ads] Başlatma hatası:", err);
      readyPromise = null;
      return false;
    }
  })();
  return readyPromise;
}

/**
 * Ödüllü reklamı yükler ve gösterir. Kullanıcı reklamı bitirip kapattığında "earned" döner.
 * "earned" krediyi garanti etmez: kredi, SSV bildirimi sunucuya ulaşınca eklenir.
 */
export async function showRewardedAd({ userId, customData }: { userId: string; customData?: string }): Promise<RewardedResult> {
  const gma = loadGma();
  const unitId = gma ? rewardedAdUnitId(gma) : null;
  if (!gma || !unitId) return "unavailable";
  if (!(await prepare(gma))) return "no-consent";

  return new Promise<RewardedResult>((resolve) => {
    const ad = gma.RewardedAd.createForAdRequest(unitId, {
      serverSideVerificationOptions: { userId, customData },
    });
    let earned = false;
    let settled = false;
    const unsubscribers: (() => void)[] = [];

    const finish = (result: RewardedResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(loadTimer);
      unsubscribers.forEach((off) => off());
      try { ad.destroy(); } catch { /* zaten yok edilmiş */ }
      resolve(result);
    };

    const loadTimer = setTimeout(() => finish("no-fill"), LOAD_TIMEOUT_MS);

    unsubscribers.push(
      ad.addAdEventListener(gma.RewardedAdEventType.LOADED, () => {
        clearTimeout(loadTimer);
        ad.show().catch((err) => {
          console.log("[Ads] Gösterim hatası:", err);
          finish("error");
        });
      }),
      ad.addAdEventListener(gma.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(gma.AdEventType.CLOSED, () => {
        finish(earned ? "earned" : "dismissed");
      }),
      ad.addAdEventListener(gma.AdEventType.ERROR, (err) => {
        const text = String((err as { code?: string; message?: string })?.code ?? (err as Error)?.message ?? err);
        console.log("[Ads] Reklam hatası:", text);
        finish(/no[-_]?fill/i.test(text) ? "no-fill" : "error");
      }),
    );

    ad.load();
  });
}
