import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { GlassTheme } from "../constants/LiquidGlass";

interface PaymentWebViewModalProps {
  visible: boolean;
  paymentUrl: string;
  successUrl: string;
  failureUrl: string;
  onSuccess: () => void;
  onFailure: (error?: string) => void;
  onClose: () => void;
}

export default function PaymentWebViewModal({
  visible,
  paymentUrl,
  successUrl,
  failureUrl,
  onSuccess,
  onFailure,
  onClose,
}: PaymentWebViewModalProps) {
  const { t } = useTranslation();
  const webViewRef = useRef<WebView>(null);
  const handledRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const handleNavigationStateChange = useCallback(
    (navState: { url: string }) => {
      if (handledRef.current) return;
      if (!navState.url || navState.url === "about:blank") return;

      const url = navState.url;

      console.log("WebView Mevcut URL:", url);

      if (url.includes("status=success") || url.includes("status=failure")) {
        handledRef.current = true;
        setLoading(false);
        webViewRef.current?.stopLoading();

        if (url.includes("status=success")) {
          onSuccess();
        } else {
          onFailure("Ödeme başarısız oldu.");
        }
      }
    },
    [onSuccess, onFailure],
  );

  const handleError = useCallback(
    (syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      if (handledRef.current) return;
      if (nativeEvent.url && nativeEvent.url.includes("status=success")) return;
      if (nativeEvent.url && nativeEvent.url.includes("status=failure")) return;
      handledRef.current = true;
      onFailure("Ödeme sayfası yüklenirken bir bağlantı hatası oluştu.");
    },
    [onFailure],
  );

  const handleClose = useCallback(() => {
    if (!handledRef.current) {
      Alert.alert(
        "Ödemeyi İptal Et",
        "Ödeme sayfasından çıkmak istediğine emin misin?",
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Çık", style: "destructive", onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={GlassTheme.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("outOfCredits.buyButton")}</Text>
          <View style={styles.closeBtn} />
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={GlassTheme.primary} />
            <Text style={styles.loadingText}>{t("payment.loading")}</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationStateChange}
          onError={handleError}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          sharedCookiesEnabled
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GlassTheme.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: GlassTheme.background,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: GlassTheme.textMain,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: GlassTheme.background,
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: GlassTheme.textMuted,
    fontWeight: "500",
  },
});
