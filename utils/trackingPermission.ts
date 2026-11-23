import { AppState, Platform } from "react-native";

// iOS App Tracking Transparency izni — uygulama açılışında, reklam/izleme verisi
// toplanmadan ÖNCE bir kez sorulur. Diğer izin pencereleri (bildirim) bunu bekler,
// böylece iki sistem penceresi çakışıp ATT isteği düşmez.
let pending: Promise<void> | null = null;

const waitUntilActive = () =>
  new Promise<void>((resolve) => {
    if (AppState.currentState === "active") return resolve();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        sub.remove();
        resolve();
      }
    });
  });

export function ensureTrackingPermission(): Promise<void> {
  if (Platform.OS !== "ios") return Promise.resolve();
  if (!pending) {
    pending = (async () => {
      try {
        await waitUntilActive();
        await new Promise((r) => setTimeout(r, 600));
        const att = require("expo-tracking-transparency");
        const current = await att.getTrackingPermissionsAsync();
        if (current.status === "undetermined") {
          await att.requestTrackingPermissionsAsync();
        }
      } catch (err) {
        console.log("[ATT] İzin istenemedi:", err);
      }
    })();
  }
  return pending;
}
