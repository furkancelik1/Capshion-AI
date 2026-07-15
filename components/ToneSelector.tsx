import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassTheme } from '@/constants/LiquidGlass';
import HapticButton from '@/components/HapticButton';

interface ToneOption {
  id: string;
  name: string;
  prompt: string;
  emoji: string;
}

const TONES: ToneOption[] = [
  { id: 'cool', name: 'Havalı', prompt: 'Trendy / Cool', emoji: '🌟' },
  { id: 'humorous', name: 'Eğlenceli', prompt: 'Witty / Humorous', emoji: '🎭' },
  { id: 'minimal', name: 'Minimalist', prompt: 'Minimal / Aesthetic', emoji: '📐' },
  { id: 'professional', name: 'Profesyonel', prompt: 'Professional / Corporate', emoji: '💼' },
  { id: 'storyteller', name: 'Hikaye Anlatıcı', prompt: 'Storyteller', emoji: '📖' },
];

interface ToneSelectorProps {
  selectedTone: string | null;
  onToneSelect: (toneId: string) => void;
}

export default function ToneSelector({ selectedTone, onToneSelect }: ToneSelectorProps) {
  const renderTone = useCallback(
    (tone: ToneOption) => {
      const isSelected = selectedTone === tone.id;

      return (
        <HapticButton
          key={tone.id}
          style={[
            styles.card,
            {
              backgroundColor: isSelected ? GlassTheme.panelStrong : GlassTheme.panel,
              borderColor: isSelected ? GlassTheme.border : GlassTheme.border,
            },
            isSelected && { borderWidth: 2 },
          ]}
          onPress={() => onToneSelect(tone.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{tone.emoji}</Text>
          <Text
            style={[styles.name, { color: GlassTheme.textMain }]}
            numberOfLines={1}
          >
            {tone.name}
          </Text>
          <Text
            style={[styles.prompt, { color: GlassTheme.textMuted }]}
            numberOfLines={1}
          >
            {tone.prompt}
          </Text>
        </HapticButton>
      );
    },
    [selectedTone, onToneSelect]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TONES.map(renderTone)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 0,
    gap: 10,
  },
  card: {
    width: 120,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: GlassTheme.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...GlassTheme.cardShadow,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  prompt: {
    fontSize: 11,
    fontWeight: '400',
  },
});
