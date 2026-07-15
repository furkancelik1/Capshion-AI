import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HapticButton from "../components/HapticButton";
import { GlassTheme } from "../constants/LiquidGlass";

interface CameraWidgetProps {
  selectedImages: string[]; // ARTIK BİR DİZİ (ARRAY) BEKLİYORUZ
  onImagesChange: (uris: string[]) => void;
}

export default function CameraWidget({
  selectedImages = [],
  onImagesChange,
}: CameraWidgetProps) {
  const pickFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("İzin Gerekli", "Galeriye erişmek için izin vermelisiniz.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false, // Çoklu seçim için kapalı olmalı
        allowsMultipleSelection: true, // ÇOKLU SEÇİM AKTİF!
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Yeni seçilen fotoğrafların URL'lerini alıp mevcut listeye ekliyoruz
        const newUris = result.assets.map((asset) => asset.uri);
        onImagesChange([...selectedImages, ...newUris]);
      }
    } catch (error) {
      console.log("Galeri açılırken hata:", error);
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("İzin Gerekli", "Kameraya erişmek için izin vermelisiniz.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Kameradan çekilen fotoğrafı mevcut listeye ekliyoruz
        onImagesChange([...selectedImages, result.assets[0].uri]);
      }
    } catch (error) {
      console.log("Kamera açılırken hata:", error);
    }
  };

  // Belirli bir fotoğrafı listeden çıkarma fonksiyonu
  const removePhoto = (indexToRemove: number) => {
    const newImages = selectedImages.filter(
      (_, index) => index !== indexToRemove,
    );
    onImagesChange(newImages);
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageBlur}>
        {/* Seçilen Görseller Karuseli */}
        {selectedImages.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {selectedImages.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />

                {/* Çıkarma (X) Butonu */}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePhoto(index)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
          /* Hiç Görsel Yoksa Gösterilecek Boş Alan */
          <View style={styles.emptyState}>
            <Ionicons
              name="images-outline"
              size={40}
              color={GlassTheme.textMuted}
            />
            <Text style={styles.emptyText}>
              Dump için birden fazla{"\n"}fotoğraf seçebilirsiniz
            </Text>
          </View>
        )}

        {/* Aksiyon Butonları (Her Zaman Görünür) */}
        <View style={styles.buttonRow}>
          <ActionButton
            label="Galeri"
            icon="images-outline"
            onPress={pickFromGallery}
          />
          <ActionButton
            label="Kamera"
            icon="camera-outline"
            onPress={takePhoto}
          />
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <HapticButton
      style={[styles.actionButton, { borderColor: GlassTheme.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={18} color={GlassTheme.textMain} />
      <Text style={[styles.actionLabel, { color: GlassTheme.textMain }]}>
        {label}
      </Text>
    </HapticButton>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  imageBlur: {
    width: "100%",
    borderRadius: GlassTheme.radiusLg,
    borderWidth: 1,
    borderColor: GlassTheme.border,
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 8,
    backgroundColor: "rgba(0,0,0,0.2)",
    ...GlassTheme.cardShadow,
  },
  carouselContainer: {
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  imageWrapper: {
    position: "relative",
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: GlassTheme.radiusMd,
    backgroundColor: GlassTheme.panelStrong,
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  emptyState: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: GlassTheme.border,
    borderRadius: GlassTheme.radiusMd,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 12,
  },
  emptyText: {
    color: GlassTheme.textMuted,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: GlassTheme.panel,
    ...GlassTheme.cardShadow,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
