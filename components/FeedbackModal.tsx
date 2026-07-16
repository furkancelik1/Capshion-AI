import { BlurView } from "expo-blur";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassTheme } from "../constants/LiquidGlass";
import { supabase } from "../services/supabase";

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
}

export default function FeedbackModal({
  visible,
  onClose,
  userId,
}: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { error } = await supabase.from("feedbacks").insert({
      user_id: userId || null,
      message: message.trim(),
    });
    setSending(false);
    if (error) {
      console.log("Geri bildirim gönderilemedi:", error.message);
      return;
    }
    setMessage("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <BlurView
          intensity={GlassTheme.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Deneyimini Geliştir</Text>
          <Text style={styles.subtitle}>
            Görüşleriniz bizim için değerli. Deneyimi senin için nasıl iyileştirebiliriz?
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Mesajınız..."
            placeholderTextColor={GlassTheme.textPlaceholder}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>Gönder</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: GlassTheme.overlayBg,
  },
  card: {
    width: "85%",
    maxWidth: 360,
    backgroundColor: GlassTheme.cardBackground,
    borderRadius: GlassTheme.radiusLg,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 16,
    ...GlassTheme.cardShadow,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GlassTheme.panelStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GlassTheme.border,
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 14,
    color: GlassTheme.textMain,
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: GlassTheme.textMain,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: GlassTheme.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  input: {
    height: 100,
    borderRadius: GlassTheme.radiusSm,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    backgroundColor: GlassTheme.panel,
    color: GlassTheme.textMain,
    fontSize: 14,
    padding: 14,
    lineHeight: 20,
  },
  sendBtn: {
    height: 48,
    borderRadius: GlassTheme.radiusSm,
    backgroundColor: GlassTheme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
