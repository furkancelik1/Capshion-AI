import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface CameraWidgetProps {
  selectedImage: string | null;
  onImageSelect: (uri: string) => void;
}

export default function CameraWidget({ selectedImage, onImageSelect }: CameraWidgetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişmek için izin vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onImageSelect(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Kameraya erişmek için izin vermelisiniz.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onImageSelect(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      {selectedImage ? (
        <View style={styles.imageWrapper}>
          <Image source={{ uri: selectedImage }} style={styles.image} />
          <View style={styles.buttonRow}>
            <ActionButton label="Galeri" icon="📷" onPress={pickFromGallery} colors={colors} />
            <ActionButton label="Kamera" icon="🎥" onPress={takePhoto} colors={colors} />
          </View>
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.placeholderIcon}>🖼️</Text>
          <Text style={[styles.placeholderText, { color: colors.icon }]}>Henüz bir fotoğraf seçilmedi</Text>
          <View style={styles.buttonRow}>
            <ActionButton label="Galeriden Seç" icon="📷" onPress={pickFromGallery} colors={colors} />
            <ActionButton label="Kamera" icon="🎥" onPress={takePhoto} colors={colors} />
          </View>
        </View>
      )}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  colors,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  colors: { text: string; tint: string; border: string };
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { borderColor: colors.tint }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[styles.actionLabel, { color: colors.tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
