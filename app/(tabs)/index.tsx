import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import CameraWidget from "../../components/CameraWidget";
import ToneSelector from "../../components/ToneSelector"; // Eğer adı tam olarak buysa
import Colors from "../../constants/Colors";
import { useGenerateCaption } from "../../hooks/useGenerateCaption";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "light" ? "light" : "dark"];
  const router = useRouter();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);

  // Yapay zeka hook'umuzu çağırıyoruz
  const { generate, loading, error } = useGenerateCaption();

  const handleImageSelected = (uri: string | null) => {
    setSelectedImage(uri);
    setSelectedTone(null); // Yeni görsel seçildiğinde ton sıfırlanır
  };

  const handleCreateCapshion = async () => {
    if (!selectedImage || !selectedTone) {
      Alert.alert(
        "Eksik Bilgi",
        "Lütfen önce bir fotoğraf seçin ve bir ton belirleyin.",
      );
      return;
    }

    // Edge Function'ı tetikleme süreci
    const result = await generate(selectedImage, selectedTone);

    if (result && result.post_id) {
      // Başarılı üretim sonrası modal detay ekranına yönlendiriyoruz
      // Detay ekranı bu post_id ile veritabanından üretilen 3 açıklamayı çekecek
      router.push(`/caption/${result.post_id}`);

      // Formu temizle
      setSelectedImage(null);
      setSelectedTone(null);
    } else if (error) {
      Alert.alert("Hata", error);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      scrollEnabled={!loading} // Yükleme esnasında kaydırmayı kilitleyelim
    >
      {/* Başlık ve Açıklama */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Capshion AI</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Fotoğrafını yükle, Instagram tarzını seç ve saniyeler içinde mükemmel
          açıklamana kavuş.
        </Text>
      </View>

      {/* Fotoğraf Yükleme Widget'ı */}
      <CameraWidget
        {...({ image: selectedImage, onImageSelected: handleImageSelected } as any)}
      />

      {/* Fotoğraf Seçildiyse Ton Seçiciyi Göster */}
      {selectedImage && (
        <View style={styles.toneSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Gönderi Tonunu Seç
          </Text>
          <ToneSelector
            selectedTone={selectedTone}
            onToneSelect={setSelectedTone}
          />
        </View>
      )}

      {/* "Capshion Oluştur" Butonu veya Loading Göstergesi */}
      {selectedImage && selectedTone && (
        <View style={styles.actionSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                Fotoğraf yükleniyor ve yapay zeka analiz ediyor...
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.tint }]}
              onPress={handleCreateCapshion}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Capshion Oluştur ✨</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  toneSection: {
    marginTop: 16,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  actionSection: {
    marginTop: 30,
    alignItems: "center",
    width: "100%",
  },
  submitButton: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
  },
});
