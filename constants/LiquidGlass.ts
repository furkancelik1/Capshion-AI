export const GlassTheme = {
  background: '#0A0A0A',
  primary: '#7A53FF',
  secondary: '#3B82F6',
  gradient: ['#7A53FF', '#3B82F6'],
  cardBackground: 'rgba(25, 25, 25, 0.95)',

  bg: '#0A0A0A',
  panel: 'rgba(255, 255, 255, 0.06)',
  panelStrong: 'rgba(255, 255, 255, 0.13)',
  border: 'rgba(255, 255, 255, 0.15)',
  textMain: '#FFFFFF',
  textMuted: '#A1A1AA',

  primaryGradient: ['#7A53FF', '#2798FF'],
  radiusSm: 10,
  radiusMd: 20,
  radiusLg: 26,
  radiusPill: 999,

  primaryButtonBg: '#FFFFFF',
  primaryButtonText: '#000000',

  glassBg: 'rgba(255, 255, 255, 0.03)',
  glassCardBg: 'rgba(28, 28, 32, 0.8)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  textSub: '#b8bfd3',
  cardBorderRadius: 26,
  blurIntensity: 20,
  selectedBorder: 'rgba(255, 255, 255, 0.16)',
  vibrantBorder: 'rgba(255, 255, 255, 0.16)',
  dangerBorder: 'rgba(255, 75, 75, 0.6)',
  dangerBg: 'rgba(255, 107, 107, 0.1)',
  dangerText: '#FF4B4B',
  cardWidth: 300,
  titleWeight: '700' as const,
  bodyWeight: '400' as const,
  textPlaceholder: '#6B6B6B',

  overlayBg: 'rgba(0, 0, 0, 0.7)',

  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
