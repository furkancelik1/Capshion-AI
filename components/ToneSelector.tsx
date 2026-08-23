import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassTheme } from '@/constants/LiquidGlass';
import HapticButton from '@/components/HapticButton';

const TONE_IDS = ['cool', 'humorous', 'minimal', 'professional', 'storyteller', 'viral', 'luxury'] as const;

const VIP_TONE_IDS = new Set(['viral', 'luxury', 'storyteller']);

const TONE_EMOJIS: Record<string, string> = {
  cool: '🌟',
  humorous: '🎭',
  minimal: '📐',
  professional: '💼',
  storyteller: '📖',
  viral: '🚀',
  luxury: '💎',
};

interface ToneSelectorProps {
  selectedTone: string | null;
  onToneSelect: (toneId: string) => void;
  isPremium?: boolean;
  onPremiumRequired?: () => void;
}

export default function ToneSelector({ selectedTone, onToneSelect, isPremium, onPremiumRequired }: ToneSelectorProps) {
  const { t } = useTranslation();

  const renderTone = useCallback(
    (toneId: string) => {
      const isSelected = selectedTone === toneId;
      const isVip = VIP_TONE_IDS.has(toneId);
      const locked = isVip && !isPremium;

      const handlePress = () => {
        if (locked) {
          onPremiumRequired?.();
          return;
        }
        onToneSelect(toneId);
      };

      return (
        <HapticButton
          key={toneId}
          style={[
            styles.card,
            {
              backgroundColor: isSelected
                ? GlassTheme.panelStrong
                : '#FFFFFF',
              borderColor: isSelected ? GlassTheme.primary : 'rgba(0,0,0,0.08)',
            },
            isSelected && { borderWidth: 1.5 },
            locked && styles.cardLocked,
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrap, locked && styles.iconWrapLocked]}>
            <Text style={styles.emoji}>{locked ? '🔒' : TONE_EMOJIS[toneId]}</Text>
          </View>
          <Text
            style={[styles.name, { color: GlassTheme.textMain }, locked && styles.nameLocked]}
            numberOfLines={1}
          >
            {t(`tones.${toneId}.name`)}
          </Text>
          <Text
            style={[styles.prompt, { color: GlassTheme.textMuted }, locked && styles.promptLocked]}
            numberOfLines={2}
          >
            {t(`tones.${toneId}.prompt`)}
          </Text>
          {locked && (
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>PRO</Text>
            </View>
          )}
        </HapticButton>
      );
    },
    [selectedTone, onToneSelect, isPremium, onPremiumRequired, t]
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
    gap: 4,
  },
  cardLocked: {
    opacity: 0.65,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  iconWrapLocked: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.2)',
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
  nameLocked: {
    color: 'rgba(28,28,30,0.35)',
  },
  prompt: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  promptLocked: {
    color: 'rgba(28,28,30,0.25)',
  },
  lockBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.15)',
  },
  lockBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
});
