import { useStripe } from "@stripe/stripe-react-native";
import { useState } from "react";
import { api } from "../services/api";
import { useToast } from "../context/ToastContext";

export function useStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const fetchPaymentSheetParams = async (amount: number, currency: string, userId?: string): Promise<{ clientSecret: string }> => {
    const data = await api.createPaymentIntent(amount, currency, userId);
    return { clientSecret: data.clientSecret };
  };

  const checkout = async (amount: number = 999, currency: string = "usd", userId?: string) => {
    setLoading(true);

    try {
      const { clientSecret } = await fetchPaymentSheetParams(amount, currency, userId);

      if (!clientSecret) {
        throw new Error("clientSecret alınamadı.");
      }

      console.log("[Stripe] initPaymentSheet baslatiliyor...");
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Capshion",
        appearance: {
          theme: "dark",
          colors: {
            primary: "#8B5CF6",
            background: "#05050A",
            componentBackground: "#121216",
            componentBorder: "#1E1E22",
            componentDivider: "#1E1E22",
            primaryText: "#FFFFFF",
            secondaryText: "#A1A1AA",
            componentText: "#FFFFFF",
            placeholderText: "#71717A",
            icon: "#8B5CF6",
          },
          shapes: {
            borderRadius: 16,
            borderWidth: 0.5,
          },
        },
      });

      if (initError) {
        console.warn("[Stripe] initPaymentSheet hatasi:", initError.message);
        throw new Error(initError.message);
      }

      console.log("[Stripe] presentPaymentSheet aciliyor...");
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === "Canceled") {
          console.log("[Stripe] Ödeme iptal edildi.");
          return { success: false, canceled: true };
        }
        console.warn("[Stripe] presentPaymentSheet hatasi:", presentError.message);
        throw new Error(presentError.message);
      }

      console.log("[Stripe] Ödeme basarili!");
      showToast("Ödeme başarılı! ✅", "success");
      return { success: true };
    } catch (err: any) {
      console.warn("[Stripe] Ödeme hatasi:", err.message);
      showToast(err.message || "Ödeme başarısız.", "error");
      return { success: false, error: err.message || "Ödeme başlatılamadı." };
    } finally {
      setLoading(false);
    }
  };

  return { checkout, loading };
}
