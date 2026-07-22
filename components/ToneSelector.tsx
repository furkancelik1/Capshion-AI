import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassTheme } from '@/constants/LiquidGlass';
import HapticButton from '@/components/HapticButton';

const TONE_IDS = ['cool', 'humorous', 'minimal', 'professional', 'storyteller'] as const;

const TONE_EMOJIS: Record<string, string> = {
  cool: '🌟',
  humorous: '🎭',
  minimal: '📐',
  professional: '💼',
  storyteller: '📖',
};

interface ToneSelectorProps {
  selectedTone: string | null;
  onToneSelect: (toneId: string) => void;
}

export default function ToneSelector({ selectedTone, onToneSelect }: ToneSelectorProps) {
  const { t } = useTranslation();

  const renderTone = useCallback(
    (toneId: string) => {
      const isSelected = selectedTone === toneId;

      return (
        <HapticButton
          key={toneId}
          style={[
            styles.card,
            {
              backgroundColor: isSelected
                ? GlassTheme.panelStrong
                : 'rgba(255,255,255,0.04)',
              borderColor: isSelected ? GlassTheme.border : 'rgba(255,255,255,0.08)',
            },
            isSelected && { borderWidth: 1.5 },
          ]}
          onPress={() => onToneSelect(toneId)}
          activeOpacity={0.7}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.emoji}>{TONE_EMOJIS[toneId]}</Text>
          </View>
          <Text
            style={[styles.name, { color: GlassTheme.textMain }]}
            numberOfLines={1}
          >
            {t(`tones.${toneId}.name`)}
          </Text>
          <Text
            style={[styles.prompt, { color: GlassTheme.textMuted }]}
            numberOfLines={2}
          >
            {t(`tones.${toneId}.prompt`)}
          </Text>
        </HapticButton>
      );
    },
    [selectedTone, onToneSelect, t]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TONE_IDS.map(renderTone)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 0,
    gap: 10,
  },
  card: {
    width: 110,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: GlassTheme.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emoji: {
    fontSize: 20,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  prompt: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
});
