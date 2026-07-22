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
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardInner}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.title}>{t("feedback.title")}</Text>
            <Text style={styles.subtitle}>
              {t("feedback.subtitle")}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={t("feedback.placeholder")}
              placeholderTextColor="rgba(255,255,255,0.4)"
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
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  card: {
    width: "85%",
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    backgroundColor: "rgba(15, 15, 20, 0.75)",
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
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 19,
  },
  input: {
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    color: "#FFFFFF",
    fontSize: 14,
    padding: 16,
    lineHeight: 20,
  },
  sendBtn: {
    height: 48,
    borderRadius: 100,
    backgroundColor: "#8B5CF6",
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
