import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { supabase } from '@/services/supabase';

interface Caption {
  text: string;
  hashtags: string[];
}

export default function CaptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: post } = await supabase
        .from('posts')
        .select('image_url')
        .eq('id', id)
        .single();

      if (post) {
        setImageUrl(post.image_url);
      }

      const { data: captionRows } = await supabase
        .from('generated_captions')
        .select('text, hashtags')
        .eq('post_id', id)
        .order('id');

      if (captionRows) {
        setCaptions(captionRows as Caption[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleCopy = async (text: string, index: number) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedIndex(index);
      Alert.alert('Kopyalandı 📋', 'Açıklama panoya kopyalandı!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      Alert.alert('Hata', 'Panoya kopyalanamadı.');
    }
  };

  const handleShare = () => {
    Alert.alert(
      'Instagram Paylaşımı',
      'Yakında Instagram doğrudan paylaşım özelliği eklenecek!',
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {imageUrl && (
        <View style={styles.imageSection}>
          <Image source={{ uri: imageUrl }} style={styles.previewImage} />
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Oluşturulan Açıklamalar
      </Text>

      {captions.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.icon }]}>
          Henüz açıklama bulunamadı.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {captions.map((caption, index) => (
            <View
              key={index}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardLabel, { color: colors.tint }]}>
                Alternatif {index + 1}
              </Text>

              <Text style={[styles.cardText, { color: colors.text }]}>
                {caption.text}
              </Text>

              <View style={styles.hashtagRow}>
                {caption.hashtags.map((tag, tagIndex) => (
                  <View
                    key={tagIndex}
                    style={[styles.hashtag, { backgroundColor: colors.tint + '20' }]}
                  >
                    <Text style={[styles.hashtagText, { color: colors.tint }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.copyButton, { borderColor: colors.tint }]}
                onPress={() => handleCopy(caption.text, index)}
                activeOpacity={0.7}
              >
                <Text style={[styles.copyButtonText, { color: colors.tint }]}>
                  {copiedIndex === index ? 'Kopyalandı ✅' : 'Kopyala 📋'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.shareButton, { backgroundColor: colors.tint }]}
        onPress={handleShare}
        activeOpacity={0.8}
      >
        <Text style={styles.shareButtonText}>Instagram'da Paylaş 🚀</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 40,
  },
  cardsRow: {
    gap: 14,
    paddingBottom: 8,
  },
  card: {
    width: 280,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 14,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  hashtag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  hashtagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  copyButton: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
