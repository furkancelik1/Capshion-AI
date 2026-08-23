import { BlurView } from "expo-blur";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import HapticButton from "./HapticButton";
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
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    if (!supabase) {
      setSending(false);
      console.warn("[Supabase] Yapılandırma eksik, geri bildirim gönderilemedi.");
      return;
    }
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
        <View style={styles.card}>
          <BlurView
            intensity={90}
            tint="systemThinMaterialLight"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardInner}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={16} color="#1C1C1E" />
            </TouchableOpacity>

            <Text style={styles.title}>{t("feedback.title")}</Text>
            <Text style={styles.subtitle}>
              {t("feedback.subtitle")}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={t("feedback.placeholder")}
              placeholderTextColor="#C7C7CC"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <HapticButton
              style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendText}>{t("feedback.send")}</Text>
              )}
            </HapticButton>
          </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  card: {
    width: "85%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  cardInner: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 14,
    color: "#1C1C1E",
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1C1C1E",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 19,
  },
  input: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    backgroundColor: "#F2F2F7",
    color: "#1C1C1E",
    fontSize: 14,
    padding: 16,
    lineHeight: 20,
  },
  sendBtn: {
    height: 48,
    borderRadius: 100,
    backgroundColor: "#34C759",
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
